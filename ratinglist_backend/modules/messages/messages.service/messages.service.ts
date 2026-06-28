import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import jwt, { JwtPayload } from "jsonwebtoken";
import { Brackets, In } from "typeorm";

import { AccountEntity } from "../../../database/entities/account.entity";
import { MessageAttachmentEntity } from "../../../database/entities/message-attachment.entity";
import { MessageConversationEntity } from "../../../database/entities/message-conversation.entity";
import { MessageLinkEntity } from "../../../database/entities/message-link.entity";
import { MessageReadStateEntity } from "../../../database/entities/message-read-state.entity";
import { MessageEntity } from "../../../database/entities/message.entity";
import { EServerModerationStatus, ServerEntity, ServerManagerEntityValue } from "../../../database/entities/server.entity";
import { UserEntity } from "../../../database/entities/users.entity";
import { AppError, NotFoundError, UnauthorizedError } from "../../../errors/appErrors";
import { ConversationListQuery, SendMessagePayload } from "../messages.types";
import { getCachedJson, invalidateCacheNamespaces } from "../../../utils/cache";

const accessSecret = (process.env.JWT_SECRET ?? "") as string;
const MESSAGE_TEXT_MAX_LENGTH = 5000;
const MESSAGE_ATTACHMENTS_MAX_COUNT = 10;
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/gi;

if (!accessSecret) {
    throw new Error("Критическая ошибка: JWT секрет не задан в .env");
}

type ConversationAccess = {
    account: AccountEntity;
    user: UserEntity;
    conversation: MessageConversationEntity;
    server: ServerEntity;
    role: "player" | "project";
};

function normalizeText(value?: string | null): string | null {
    const text = value?.trim();
    return text ? text : null;
}

function normalizeManagers(value: unknown): ServerManagerEntityValue[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter((item): item is ServerManagerEntityValue => Boolean(item) && typeof item === "object")
        .map((item) => ({
            id: String(item.id),
            userId: item.userId ? String(item.userId) : undefined,
            name: item.name ? String(item.name) : undefined,
            email: String(item.email),
            createdAt: String(item.createdAt),
        }))
        .filter((item) => item.id && item.email && item.createdAt);
}

function extractLinks(text: string | null): string[] {
    if (!text) {
        return [];
    }

    const matches = text.match(URL_PATTERN) ?? [];
    return Array.from(new Set(matches.map((url) => url.replace(/[),.;!?]+$/g, ""))));
}

function buildManagerLookup(server: ServerEntity): Map<string, ServerManagerEntityValue> {
    const managers = normalizeManagers(server.managers).filter((manager): manager is ServerManagerEntityValue & { userId: string } => Boolean(manager.userId));
    return new Map(managers.map((manager) => [manager.userId, manager]));
}

export class MessagesService {
    constructor(private readonly fastify: FastifyInstance) {}

    private get accountRepository() {
        return this.fastify.dataSource.getRepository(AccountEntity);
    }

    private get userRepository() {
        return this.fastify.dataSource.getRepository(UserEntity);
    }

    private get serverRepository() {
        return this.fastify.dataSource.getRepository(ServerEntity);
    }

    private get conversationRepository() {
        return this.fastify.dataSource.getRepository(MessageConversationEntity);
    }

    private get messageRepository() {
        return this.fastify.dataSource.getRepository(MessageEntity);
    }

    private get attachmentRepository() {
        return this.fastify.dataSource.getRepository(MessageAttachmentEntity);
    }

    private get linkRepository() {
        return this.fastify.dataSource.getRepository(MessageLinkEntity);
    }

    private get readStateRepository() {
        return this.fastify.dataSource.getRepository(MessageReadStateEntity);
    }

    private async verifyAccessToken(token: string): Promise<JwtPayload> {
        try {
            return jwt.verify(token, accessSecret) as JwtPayload;
        } catch {
            throw new UnauthorizedError("Неверный или просроченный access token");
        }
    }

    private async getAccountFromAccessToken(token?: string): Promise<AccountEntity> {
        if (!token) {
            throw new UnauthorizedError("Access token не предоставлен");
        }

        const decoded = await this.verifyAccessToken(token);
        const subject = decoded.sub as string | undefined;

        if (!subject) {
            throw new UnauthorizedError("Неверный access token (нет sub)");
        }

        const account = await this.accountRepository.findOne({ where: { id: subject } });

        if (!account) {
            throw new UnauthorizedError("Аккаунт не найден");
        }

        return account;
    }

    private async getCurrentUser(token?: string): Promise<{ account: AccountEntity; user: UserEntity }> {
        const account = await this.getAccountFromAccessToken(token);
        const user = await this.userRepository.findOne({ where: { id: account.userId } });

        if (!user) {
            throw new UnauthorizedError("Связанный пользователь не найден");
        }

        return { account, user };
    }

    private async getServerByIdOrSlug(serverId: string): Promise<ServerEntity | null> {
        return await this.serverRepository.findOne({
            where: [{ id: serverId }, { slug: serverId }],
            relations: { owner: true },
        });
    }

    private isServerTeamMember(server: ServerEntity, userId: string): boolean {
        if (server.ownerUserId === userId) {
            return true;
        }

        return normalizeManagers(server.managers).some((manager) => manager.userId === userId);
    }

    private displayName(user: UserEntity): string {
        const directName = user.username?.trim();
        const composedName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
        return directName || composedName || "Пользователь";
    }

    private async getStaffServerIds(userId: string): Promise<string[]> {
        const servers = await this.serverRepository
            .createQueryBuilder("server")
            .select(["server.id"])
            .where("server.ownerUserId = :userId", { userId })
            .orWhere("server.managers @> CAST(:managerFilter AS jsonb)", { managerFilter: JSON.stringify([{ userId }]) })
            .getMany();

        return servers.map((server) => server.id);
    }

    private async getConversationAccess(token: string | undefined, conversationId: string): Promise<ConversationAccess> {
        const { account, user } = await this.getCurrentUser(token);
        const conversation = await this.conversationRepository.findOne({
            where: { id: conversationId },
            relations: { player: true, server: { owner: true } },
        });

        if (!conversation) {
            throw new NotFoundError("Диалог не найден");
        }

        const server = conversation.server ?? (await this.getServerByIdOrSlug(conversation.serverId));

        if (!server) {
            throw new NotFoundError("Сервер диалога не найден");
        }

        if (conversation.playerUserId === user.id) {
            return { account, user, conversation, server, role: "player" };
        }

        if (this.isServerTeamMember(server, user.id)) {
            return { account, user, conversation, server, role: "project" };
        }

        throw new UnauthorizedError("Нет доступа к этому диалогу");
    }

    private serializeUser(user: UserEntity | null | undefined) {
        if (!user) {
            return null;
        }

        return {
            id: user.id,
            name: this.displayName(user),
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            avatarUrl: user.avatarUrl,
        };
    }

    private serializeServer(server: ServerEntity) {
        return {
            id: server.id,
            slug: server.slug,
            name: server.name,
            logoUrl: server.logoUrl,
            bannerUrl: server.bannerUrl,
        };
    }

    private serializeAttachment(attachment: MessageAttachmentEntity) {
        return {
            id: attachment.id,
            type: attachment.type,
            url: attachment.url,
            publicId: attachment.publicId,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
            createdAt: attachment.createdAt,
        };
    }

    private serializeLink(link: MessageLinkEntity) {
        return {
            id: link.id,
            url: link.url,
            createdAt: link.createdAt,
        };
    }

    private serializeMessage(message: MessageEntity, currentUserId: string, server?: ServerEntity) {
        const sender = this.serializeUser(message.sender);
        const senderName = sender?.name ?? "Пользователь";
        const managerLookup = server ? buildManagerLookup(server) : new Map<string, ServerManagerEntityValue>();
        const senderTitle = server
            ? message.senderUserId === server.ownerUserId
                ? `Администратор ${senderName}`
                : managerLookup.has(message.senderUserId)
                  ? `Менеджер ${senderName}`
                  : senderName
            : senderName;

        return {
            id: message.id,
            conversationId: message.conversationId,
            senderUserId: message.senderUserId,
            sender,
            senderTitle,
            text: message.text,
            isOwn: message.senderUserId === currentUserId,
            createdAt: message.createdAt,
            attachments: (message.attachments ?? []).map((attachment) => this.serializeAttachment(attachment)),
            links: (message.links ?? []).map((link) => this.serializeLink(link)),
        };
    }

    private async getUnreadCount(conversationId: string, userId: string): Promise<number> {
        const readState = await this.readStateRepository.findOne({
            where: { conversationId, userId },
        });
        const qb = this.messageRepository
            .createQueryBuilder("message")
            .where("message.conversationId = :conversationId", { conversationId })
            .andWhere("message.senderUserId != :userId", { userId });

        if (readState?.lastReadAt) {
            qb.andWhere("message.createdAt > :lastReadAt", { lastReadAt: readState.lastReadAt });
        }

        return await qb.getCount();
    }

    private async getUnreadCounts(conversationIds: string[], userId: string): Promise<Map<string, number>> {
        if (conversationIds.length === 0) {
            return new Map();
        }

        const rows = await this.fastify.dataSource.query<Array<{ conversationId: string; unreadCount: string | number }>>(
            `
                SELECT
                    conversation."id" AS "conversationId",
                    COUNT(message."id")::integer AS "unreadCount"
                FROM "message_conversations" conversation
                LEFT JOIN "message_read_states" read_state
                    ON read_state."conversationId" = conversation."id"
                    AND read_state."userId" = $2
                LEFT JOIN "messages" message
                    ON message."conversationId" = conversation."id"
                    AND message."senderUserId" != $2
                    AND (
                        read_state."lastReadAt" IS NULL
                        OR message."createdAt" > read_state."lastReadAt"
                    )
                WHERE conversation."id" = ANY($1::varchar[])
                GROUP BY conversation."id"
            `,
            [conversationIds, userId],
        );

        return new Map(rows.map((row) => [row.conversationId, Number(row.unreadCount ?? 0)]));
    }

    private conversationUserIds(conversation: MessageConversationEntity, server: ServerEntity): string[] {
        return Array.from(new Set([
            conversation.playerUserId,
            server.ownerUserId,
            ...normalizeManagers(server.managers).map((manager) => manager.userId).filter(Boolean) as string[],
        ]));
    }

    private async invalidateConversationCaches(conversation: MessageConversationEntity, server: ServerEntity, userIds?: string[]) {
        const affectedUserIds = userIds ?? this.conversationUserIds(conversation, server);
        await invalidateCacheNamespaces(this.fastify, [
            `messages:conversation:${conversation.id}`,
            `messages:conversation-server:${server.id}`,
            ...affectedUserIds.map((userId) => `messages:user:${userId}`),
        ]);
    }

    private async serializeConversation(
        conversation: MessageConversationEntity,
        currentUserId: string,
        knownUnreadCount?: number,
    ) {
        const server = conversation.server;
        const player = conversation.player;
        const isPlayerView = conversation.playerUserId === currentUserId;
        const unreadCount = knownUnreadCount ?? await this.getUnreadCount(conversation.id, currentUserId);

        return {
            id: conversation.id,
            server: this.serializeServer(server),
            participant: isPlayerView
                ? {
                      id: server.id,
                      name: server.name,
                      avatarUrl: server.logoUrl ?? server.bannerUrl,
                      role: "project",
                  }
                : {
                      id: player.id,
                      name: this.displayName(player),
                      avatarUrl: player.avatarUrl,
                      role: "player",
                  },
            lastMessage: conversation.lastMessageId
                ? {
                      id: conversation.lastMessageId,
                      text: conversation.lastMessageText,
                      senderUserId: conversation.lastMessageSenderUserId,
                      createdAt: conversation.lastMessageAt,
                  }
                : null,
            unreadCount,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
        };
    }

    async startConversation(token: string | undefined, serverId: string) {
        const { user } = await this.getCurrentUser(token);
        const server = await this.getServerByIdOrSlug(serverId);

        if (!server || !server.isMotdVerified || server.moderationStatus !== EServerModerationStatus.Approved) {
            throw new NotFoundError("Сервер не найден");
        }

        if (this.isServerTeamMember(server, user.id)) {
            throw new AppError("Команда проекта не может начать диалог со своим сервером как игрок", 400);
        }

        let conversation = await this.conversationRepository.findOne({
            where: {
                serverId: server.id,
                playerUserId: user.id,
            },
            relations: { player: true, server: true },
        });

        if (!conversation) {
            conversation = this.conversationRepository.create({
                id: randomUUID(),
                serverId: server.id,
                playerUserId: user.id,
                lastMessageId: null,
                lastMessageText: null,
                lastMessageSenderUserId: null,
                lastMessageAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await this.conversationRepository.save(conversation);
            conversation = await this.conversationRepository.findOneOrFail({
                where: { id: conversation.id },
                relations: { player: true, server: true },
            });
            await this.invalidateConversationCaches(conversation, server);
        }

        return {
            conversation: await this.serializeConversation(conversation, user.id),
        };
    }

    async listConversations(token: string | undefined, query: ConversationListQuery = {}) {
        const { user } = await this.getCurrentUser(token);
        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(Math.max(query.limit ?? 30, 1), 50);
        const search = normalizeText(query.search);
        return await getCachedJson(
            this.fastify,
            `messages:user:${user.id}`,
            { type: "list", page, limit, search, serverId: query.serverId ?? null },
            15,
            async () => {
                const staffServerIds = await this.getStaffServerIds(user.id);
                const server = query.serverId ? await this.getServerByIdOrSlug(query.serverId) : null;

                if (query.serverId && !server) {
                    return {
                        items: [],
                        page,
                        limit,
                        total: 0,
                        totalPages: 0,
                    };
                }

                const qb = this.conversationRepository
                    .createQueryBuilder("conversation")
                    .leftJoinAndSelect("conversation.server", "server")
                    .leftJoinAndSelect("conversation.player", "player")
                    .where(
                        new Brackets((visible) => {
                            visible.where("conversation.playerUserId = :userId", { userId: user.id });

                            if (staffServerIds.length > 0) {
                                visible.orWhere("conversation.serverId IN (:...staffServerIds)", { staffServerIds });
                            }
                        }),
                    );

                if (server) {
                    qb.andWhere("conversation.serverId = :serverId", { serverId: server.id });
                }

                if (search) {
                    const searchPattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
                    qb.andWhere(
                        `(
                            server.name ILIKE :searchPattern
                            OR COALESCE(player.username, '') ILIKE :searchPattern
                            OR COALESCE(player.firstName, '') ILIKE :searchPattern
                            OR COALESCE(player.lastName, '') ILIKE :searchPattern
                            OR COALESCE(conversation.lastMessageText, '') ILIKE :searchPattern
                        )`,
                        { searchPattern },
                    );
                }

                qb.orderBy("conversation.lastMessageAt", "DESC", "NULLS LAST")
                    .addOrderBy("conversation.createdAt", "DESC")
                    .skip((page - 1) * limit)
                    .take(limit);

                const [conversations, total] = await qb.getManyAndCount();
                const unreadCounts = await this.getUnreadCounts(conversations.map((conversation) => conversation.id), user.id);

                return {
                    items: await Promise.all(
                        conversations.map((conversation) =>
                            this.serializeConversation(conversation, user.id, unreadCounts.get(conversation.id) ?? 0),
                        ),
                    ),
                    page,
                    limit,
                    total,
                    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
                };
            },
        );
    }

    async getConversation(token: string | undefined, conversationId: string) {
        const { user, conversation } = await this.getConversationAccess(token, conversationId);
        return await getCachedJson(
            this.fastify,
            `messages:conversation:${conversation.id}`,
            { type: "detail", userId: user.id },
            15,
            async () => {
                const messages = await this.messageRepository.find({
                    where: { conversationId: conversation.id },
                    relations: { sender: true, attachments: true, links: true },
                    order: { createdAt: "ASC" },
                });

                return {
                    conversation: await this.serializeConversation(conversation, user.id),
                    messages: messages.map((message) => this.serializeMessage(message, user.id, conversation.server)),
                };
            },
        );
    }

    async sendMessage(token: string | undefined, conversationId: string, payload: SendMessagePayload) {
        const { user, conversation } = await this.getConversationAccess(token, conversationId);
        const text = normalizeText(payload.text);
        const attachments = payload.attachments ?? [];

        if (!text && attachments.length === 0) {
            throw new AppError("Нельзя отправить пустое сообщение", 400);
        }

        if (text && text.length > MESSAGE_TEXT_MAX_LENGTH) {
            throw new AppError("Сообщение слишком длинное", 400);
        }

        if (attachments.length > MESSAGE_ATTACHMENTS_MAX_COUNT) {
            throw new AppError("Можно прикрепить не больше 10 файлов", 400);
        }

        const now = new Date();
        const message = this.messageRepository.create({
            id: randomUUID(),
            conversationId: conversation.id,
            senderUserId: user.id,
            text,
            createdAt: now,
        });

        await this.messageRepository.save(message);

        const savedAttachments = attachments.map((attachment) =>
            this.attachmentRepository.create({
                id: randomUUID(),
                messageId: message.id,
                type: attachment.type,
                url: attachment.url,
                publicId: attachment.publicId ?? null,
                mimeType: attachment.mimeType,
                sizeBytes: attachment.sizeBytes,
                createdAt: now,
            }),
        );
        const links = extractLinks(text).map((url) =>
            this.linkRepository.create({
                id: randomUUID(),
                messageId: message.id,
                url,
                createdAt: now,
            }),
        );

        if (savedAttachments.length > 0) {
            await this.attachmentRepository.save(savedAttachments);
        }

        if (links.length > 0) {
            await this.linkRepository.save(links);
        }

        conversation.lastMessageId = message.id;
        conversation.lastMessageText = text ?? (savedAttachments.length > 0 ? "Медиафайл" : null);
        conversation.lastMessageSenderUserId = user.id;
        conversation.lastMessageAt = now;
        conversation.updatedAt = now;
        await this.conversationRepository.save(conversation);

        await this.readStateRepository.save({
            conversationId: conversation.id,
            userId: user.id,
            lastReadMessageId: message.id,
            lastReadAt: now,
        });
        await this.invalidateConversationCaches(conversation, conversation.server);

        const savedMessage = await this.messageRepository.findOneOrFail({
            where: { id: message.id },
            relations: { sender: true, attachments: true, links: true },
        });

        return {
            message: this.serializeMessage(savedMessage, user.id, conversation.server),
            conversation: await this.serializeConversation(conversation, user.id),
        };
    }

    async markConversationRead(token: string | undefined, conversationId: string) {
        const { user, conversation } = await this.getConversationAccess(token, conversationId);

        await this.readStateRepository.save({
            conversationId: conversation.id,
            userId: user.id,
            lastReadMessageId: conversation.lastMessageId,
            lastReadAt: conversation.lastMessageAt ?? new Date(),
        });
        await this.invalidateConversationCaches(conversation, conversation.server, [user.id]);

        return {
            success: true,
            unreadCount: 0,
        };
    }

    async getConversationMedia(token: string | undefined, conversationId: string) {
        const { conversation } = await this.getConversationAccess(token, conversationId);
        return await getCachedJson(
            this.fastify,
            `messages:conversation:${conversation.id}`,
            { type: "media" },
            30,
            async () => {
                const messages = await this.messageRepository.find({
                    where: { conversationId: conversation.id },
                    relations: { attachments: true },
                    order: { createdAt: "DESC" },
                });
                const media = messages.flatMap((message) =>
                    (message.attachments ?? []).map((attachment) => ({
                        ...this.serializeAttachment(attachment),
                        messageId: message.id,
                    })),
                );

                return { items: media };
            },
        );
    }

    async getConversationLinks(token: string | undefined, conversationId: string) {
        const { conversation } = await this.getConversationAccess(token, conversationId);
        return await getCachedJson(
            this.fastify,
            `messages:conversation:${conversation.id}`,
            { type: "links" },
            30,
            async () => {
                const links = await this.linkRepository.find({
                    where: { message: { conversationId: conversation.id } },
                    relations: { message: true },
                    order: { createdAt: "DESC" },
                });

                return {
                    items: links.map((link) => ({
                        ...this.serializeLink(link),
                        messageId: link.messageId,
                    })),
                };
            },
        );
    }

    async getUnreadSummary(token: string | undefined) {
        const { user } = await this.getCurrentUser(token);
        return await getCachedJson(this.fastify, `messages:user:${user.id}`, { type: "unread-summary" }, 10, async () => {
            const staffServerIds = await this.getStaffServerIds(user.id);
            const visibleConversations = await this.conversationRepository.find({
                select: { id: true, playerUserId: true },
                where: [
                    { playerUserId: user.id },
                    ...(staffServerIds.length > 0 ? [{ serverId: In(staffServerIds) }] : []),
                ],
            });
            const unreadCounts = await this.getUnreadCounts(visibleConversations.map((conversation) => conversation.id), user.id);
            const unreadConversations = visibleConversations.filter((conversation) => (unreadCounts.get(conversation.id) ?? 0) > 0);
            const unreadPlayerIds = new Set(
                unreadConversations
                    .filter((conversation) => conversation.playerUserId !== user.id)
                    .map((conversation) => conversation.playerUserId),
            );

            return {
                unreadConversationsCount: unreadConversations.length,
                unreadPlayersCount: unreadPlayerIds.size || unreadConversations.length,
            };
        });
    }
}
