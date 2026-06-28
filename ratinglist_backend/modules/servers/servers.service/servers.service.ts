import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import jwt, { JwtPayload } from "jsonwebtoken";
import { In } from "typeorm";

import { AppError, NotFoundError, UnauthorizedError } from "../../../errors/appErrors";
import { AccountEntity } from "../../../database/entities/account.entity";
import { ServerAnalyticsEntity } from "../../../database/entities/server-analytics.entity";
import { EServerModerationStatus, ServerEntity, ServerManagerEntityValue } from "../../../database/entities/server.entity";
import { UserEntity } from "../../../database/entities/users.entity";
import { normalizeEmail } from "../../auth/security.utils";
import { AdminServerListQuery, AdminServerReviewPayload, CreateServerPayload, ServerAiSearchQuery, ServerListQuery, ServerManagerPayload, UpdateServerPayload } from "../servers.types";
import { ServerSemanticSearchService } from "./server-semantic-search.service";
import { getCachedJson, invalidateCacheNamespaces } from "../../../utils/cache";
import { ServerScannerService } from "../../analytics/analytics.service/server-scanner.service";

const accessSecret = (process.env.JWT_SECRET ?? "") as string;

if (!accessSecret) {
    throw new Error("Критическая ошибка: JWT секрет не задан в .env");
}

function normalizeText(value?: string | null): string | null {
    const text = value?.trim();
    return text ? text : null;
}

function normalizeIp(value: string): string {
    return value.trim().toLowerCase();
}

function normalizeArray(value?: string[]): string[] {
    return (value ?? []).map((item) => item.trim()).filter(Boolean);
}

function normalizeCategories(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return value as Record<string, unknown>;
}

function normalizeVersions(value?: string[]): string[] {
    return normalizeArray(value);
}

function escapeLikePattern(value: string): string {
    return value.replace(/[\\%_]/g, "\\$&");
}

function slugify(value: string): string {
    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}

function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildFallbackManagerName(email: string): string {
    const [localPart] = email.split("@");
    return localPart?.trim() || "Пользователь";
}

function buildMotdVerificationCode(): string {
    return `ASTRONIX-VERIFY-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

function buildMotdVerificationText(code: string): string {
    return `Добавьте этот код в MOTD сервера: ${code}`;
}

export class ServersService {
    constructor(private readonly fastify: FastifyInstance) {}

    private async invalidateServerCaches(server: ServerEntity, affectedUserIds: string[] = []) {
        await invalidateCacheNamespaces(this.fastify, [
            "servers:list",
            "servers:search",
            "servers:detail",
            "servers:embeddings",
            "servers:user",
            `analytics:players:${server.id}`,
            `analytics:summary:${server.id}`,
            `votes:summary:${server.id}`,
            "votes:leaderboard",
            `messages:conversation-server:${server.id}`,
            ...affectedUserIds.flatMap((userId) => [
                `messages:user:${userId}`,
            ]),
        ]);
    }

    private get serverRepository() {
        return this.fastify.dataSource.getRepository(ServerEntity);
    }

    private get accountRepository() {
        return this.fastify.dataSource.getRepository(AccountEntity);
    }

    private get analyticsRepository() {
        return this.fastify.dataSource.getRepository(ServerAnalyticsEntity);
    }

    private get userRepository() {
        return this.fastify.dataSource.getRepository(UserEntity);
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

    private async getAdminAccountFromAccessToken(token?: string): Promise<AccountEntity> {
        const account = await this.getAccountFromAccessToken(token);
        const adminEmails = (process.env.ADMIN_EMAILS ?? process.env.PANEL_ADMIN_EMAILS ?? "")
            .split(",")
            .map((email) => normalizeEmail(email))
            .filter(Boolean);

        if (adminEmails.length > 0 && !adminEmails.includes(normalizeEmail(account.email))) {
            throw new AppError("Недостаточно прав для модерации серверов", 403);
        }

        return account;
    }

    private async getUserById(id: string): Promise<UserEntity | null> {
        return await this.userRepository.findOne({ where: { id } });
    }

    private async getAccountByEmail(email: string): Promise<AccountEntity | null> {
        return await this.accountRepository.findOne({ where: { email } });
    }

    private async getServerByIdOrSlug(serverId: string): Promise<ServerEntity | null> {
        return await this.serverRepository.findOne({
            where: [{ id: serverId }, { slug: serverId }],
            relations: { owner: true },
        });
    }

    private isPublicServer(server: ServerEntity): boolean {
        return server.isMotdVerified && server.moderationStatus === EServerModerationStatus.Approved;
    }

    private async getServerOwner(server: ServerEntity): Promise<UserEntity> {
        const owner = server.owner ?? (await this.getUserById(server.ownerUserId));

        if (!owner) {
            throw new NotFoundError("Владелец сервера не найден");
        }

        return owner;
    }

    private displayName(user: UserEntity): string {
        const directName = user.username?.trim();
        const composedName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
        return directName || composedName || "Пользователь";
    }

    private serializeLatestStatus(analytics?: ServerAnalyticsEntity) {
        if (!analytics) {
            return null;
        }

        return {
            isOnline: analytics.isOnline,
            latencyMs: analytics.latencyMs,
            playersOnline: analytics.playersOnline,
            playersMax: analytics.playersMax,
            versionName: analytics.versionName,
            protocolVersion: analytics.protocolVersion,
            motd: analytics.motd,
            checkedAt: analytics.scannedAt?.toISOString() ?? null,
        };
    }

    private resolveServerAccessRole(server: ServerEntity, userId?: string): "owner" | "manager" | null {
        if (!userId) {
            return null;
        }

        if (server.ownerUserId === userId) {
            return "owner";
        }

        if (
            server.motdClaimUserId === userId
            && server.moderationStatus === EServerModerationStatus.MotdPending
        ) {
            return "owner";
        }

        if (this.normalizeManagers(server.managers).some((manager) => manager.userId === userId)) {
            return "manager";
        }

        return null;
    }

    private serializeServer(server: ServerEntity, latestStatus?: ServerAnalyticsEntity, currentUserId?: string) {
        const owner = server.owner;
        const accessRole = this.resolveServerAccessRole(server, currentUserId);
        const canSeeMotdCode = Boolean(
            currentUserId
            && accessRole === "owner"
            && (!server.motdClaimUserId || server.motdClaimUserId === currentUserId)
        );

        return {
            id: server.id,
            slug: server.slug,
            name: server.name,
            ip: server.ip,
            port: server.port,
            slogan: server.slogan,
            description: server.description,
            website: server.website,
            youtube: server.youtube,
            discord: server.discord,
            telegram: server.telegram,
            vk: server.vk,
            bannerUrl: server.bannerUrl,
            logoUrl: server.logoUrl,
            categories: server.categories,
            imageUrls: server.imageUrls,
            versions: server.versions,
            managers: this.serializeManagers(server.managers),
            rating: server.rating,
            isMotdVerified: server.isMotdVerified,
            motdVerificationCode: canSeeMotdCode ? server.motdVerificationCode : null,
            moderationStatus: server.moderationStatus,
            moderationComment: server.moderationComment,
            motdVerifiedAt: server.motdVerifiedAt,
            reviewedAt: server.reviewedAt,
            createdAt: server.createdAt,
            updatedAt: server.updatedAt,
            latestStatus: this.serializeLatestStatus(latestStatus),
            accessRole,
            owner: owner
                ? {
                      id: owner.id,
                      username: owner.username,
                      firstName: owner.firstName,
                      lastName: owner.lastName,
                      avatarUrl: owner.avatarUrl,
                      name: this.displayName(owner),
                  }
                : null,
        };
    }

    private serializeManagers(managers?: ServerManagerEntityValue[]) {
        return (managers ?? []).map((manager) => ({
            id: manager.id,
            name: manager.name ?? buildFallbackManagerName(manager.email),
            email: manager.email,
            createdAt: manager.createdAt,
            avatarUrl: null,
        }));
    }

    private normalizeManagers(value: unknown): ServerManagerEntityValue[] {
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

    private async hydrateManagers(managers: ServerManagerEntityValue[]) {
        const uniqueUserIds = Array.from(new Set(managers.map((manager) => manager.userId).filter(Boolean) as string[]));
        const users = uniqueUserIds.length > 0
            ? await this.userRepository.find({
                where: { id: In(uniqueUserIds) },
            })
            : [];
        const usersById = new Map(users.map((user) => [user.id, user]));

        return managers.map((manager) => {
            const user = manager.userId ? usersById.get(manager.userId) : null;
            const resolvedName = user ? this.displayName(user) : (manager.name ?? buildFallbackManagerName(manager.email));

            return {
                id: manager.id,
                name: resolvedName,
                email: manager.email,
                createdAt: manager.createdAt,
                avatarUrl: user?.avatarUrl ?? null,
            };
        });
    }

    private async getLatestStatusByServerIds(serverIds: string[]) {
        if (serverIds.length === 0) {
            return new Map<string, ServerAnalyticsEntity>();
        }

        const rows = await this.analyticsRepository
            .createQueryBuilder("analytics")
            .distinctOn(["analytics.serverId"])
            .where("analytics.serverId IN (:...serverIds)", { serverIds })
            .andWhere("analytics.scannedAt IS NOT NULL")
            .orderBy("analytics.serverId", "ASC")
            .addOrderBy("analytics.bucketAt", "DESC")
            .getMany();

        return new Map(rows.map((row) => [row.serverId, row]));
    }

    private async ensureUniqueSlug(name: string): Promise<string> {
        const baseSlug = slugify(name) || `server-${randomUUID().slice(0, 8)}`;
        let slug = baseSlug;
        let attempt = 0;

        while (await this.serverRepository.existsBy({ slug })) {
            attempt += 1;
            slug = `${baseSlug}-${attempt}`;
        }

        return slug;
    }

    private async ensureIpIsAvailable(ip: string, excludeServerId?: string): Promise<void> {
        const normalizedIp = normalizeIp(ip);
        const existing = await this.serverRepository.findOne({ where: { ip: normalizedIp } });

        if (!existing) {
            return;
        }

        if (excludeServerId && existing.id === excludeServerId) {
            return;
        }

        throw new AppError("Сервер с таким IP уже существует", 409);
    }

    private async getOwnedServer(token: string | undefined, serverId: string): Promise<{ account: AccountEntity; server: ServerEntity }> {
        const account = await this.getAccountFromAccessToken(token);
        const server = await this.getServerByIdOrSlug(serverId);

        if (!server) {
            throw new NotFoundError("Сервер не найден");
        }

        if (server.ownerUserId !== account.userId) {
            throw new UnauthorizedError("Сервер не принадлежит текущему пользователю");
        }

        return { account, server };
    }

    async listServers(query: ServerListQuery) {
        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
        const minRating = query.minRating;
        const maxRating = query.maxRating;
        const search = normalizeText(query.search);
        const sortDirection = query.sort === "rating_asc" ? "ASC" : "DESC";

        return await getCachedJson(
            this.fastify,
            "servers:list",
            { page, limit, minRating, maxRating, search, sortDirection },
            60,
            async () => {
                const qb = this.serverRepository
                    .createQueryBuilder("server")
                    .leftJoinAndSelect("server.owner", "owner")
                    .where("server.isMotdVerified = :isMotdVerified", { isMotdVerified: true })
                    .andWhere("server.moderationStatus = :moderationStatus", {
                        moderationStatus: EServerModerationStatus.Approved,
                    });

                if (typeof minRating === "number") {
                    qb.andWhere("server.rating >= :minRating", { minRating });
                }

                if (typeof maxRating === "number") {
                    qb.andWhere("server.rating <= :maxRating", { maxRating });
                }

                if (search) {
                    const searchPattern = `%${escapeLikePattern(search)}%`;

                    qb.andWhere(
                        `(
                            server.name ILIKE :searchPattern
                            OR server.slug ILIKE :searchPattern
                            OR server.ip ILIKE :searchPattern
                            OR COALESCE(server.slogan, '') ILIKE :searchPattern
                            OR COALESCE(server.description, '') ILIKE :searchPattern
                        )`,
                        { searchPattern },
                    );
                }

                qb.orderBy("server.rating", sortDirection).addOrderBy("server.createdAt", "DESC").skip((page - 1) * limit).take(limit);

                const [servers, total] = await qb.getManyAndCount();
                const latestStatus = await this.getLatestStatusByServerIds(servers.map((server) => server.id));

                return {
                    items: servers.map((server) => this.serializeServer(server, latestStatus.get(server.id))),
                    page,
                    limit,
                    total,
                    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
                };
            },
        );
    }

    async searchServersWithAi(query: ServerAiSearchQuery) {
        const search = query.search.trim();
        const limit = Math.min(Math.max(query.limit ?? 8, 1), 20);
        return await getCachedJson(this.fastify, "servers:search", { search: search.toLowerCase(), limit }, 300, async () => {
            const semanticSearch = new ServerSemanticSearchService(this.fastify);
            const serverIds = await semanticSearch.findServerIds(search, limit);

            if (serverIds.length === 0) {
                return { items: [] };
            }

            const servers = await this.serverRepository.find({
                where: { id: In(serverIds) },
                relations: { owner: true },
            });
            const serversById = new Map(servers.map((server) => [server.id, server]));
            const latestStatus = await this.getLatestStatusByServerIds(serverIds);

            return {
                items: serverIds
                    .map((serverId) => serversById.get(serverId))
                    .filter((server): server is ServerEntity => Boolean(server))
                    .map((server) => this.serializeServer(server, latestStatus.get(server.id))),
            };
        });
    }

    async getServer(serverId: string, token?: string) {
        if (!token) {
            return await getCachedJson(this.fastify, "servers:detail", { serverId }, 60, async () => {
                const publicServer = await this.getServerByIdOrSlug(serverId);

                if (!publicServer || !this.isPublicServer(publicServer)) {
                    throw new NotFoundError("Сервер не найден");
                }

                const latestStatus = await this.getLatestStatusByServerIds([publicServer.id]);
                return { server: this.serializeServer(publicServer, latestStatus.get(publicServer.id)) };
            });
        }

        const server = await this.getServerByIdOrSlug(serverId);

        if (!server) {
            throw new NotFoundError("Сервер не найден");
        }

        const account = await this.getAccountFromAccessToken(token).catch(() => null);
        const hasPrivateAccess = account
            ? Boolean(this.resolveServerAccessRole(server, account.userId))
            : false;

        if (!this.isPublicServer(server) && !hasPrivateAccess) {
            throw new NotFoundError("Сервер не найден");
        }

        const latestStatus = await this.getLatestStatusByServerIds([server.id]);

        return { server: this.serializeServer(server, latestStatus.get(server.id), account?.userId) };
    }

    async getMyServers(token?: string) {
        const account = await this.getAccountFromAccessToken(token);
        return await getCachedJson(this.fastify, "servers:user", { userId: account.userId }, 45, async () => {
            const servers = await this.serverRepository
                .createQueryBuilder("server")
                .leftJoinAndSelect("server.owner", "owner")
                .where("server.ownerUserId = :userId", { userId: account.userId })
                .orWhere("server.managers @> CAST(:managerFilter AS jsonb)", {
                    managerFilter: JSON.stringify([{ userId: account.userId }]),
                })
                .orWhere("server.motdClaimUserId = :userId", { userId: account.userId })
                .orderBy("server.createdAt", "DESC")
                .getMany();
            const latestStatus = await this.getLatestStatusByServerIds(servers.map((server) => server.id));

            return {
                items: servers.map((server) => this.serializeServer(server, latestStatus.get(server.id), account.userId)),
            };
        });
    }

    async createServer(token: string | undefined, payload: CreateServerPayload) {
        const account = await this.getAccountFromAccessToken(token);
        const owner = await this.getUserById(account.userId);

        if (!owner) {
            throw new UnauthorizedError("Связанный пользователь не найден");
        }

        const slug = await this.ensureUniqueSlug(payload.name);
        const ip = normalizeIp(payload.ip);
        const motdVerificationCode = buildMotdVerificationCode();
        const existingServer = await this.serverRepository.findOne({
            where: { ip },
            relations: { owner: true },
        });

        if (existingServer) {
            if (
                existingServer.isMotdVerified
                || existingServer.moderationStatus !== EServerModerationStatus.MotdPending
            ) {
                throw new AppError("Сервер с таким IP уже существует", 409);
            }

            existingServer.motdClaimUserId = owner.id;
            existingServer.motdClaimedAt = new Date();
            existingServer.motdVerificationCode = motdVerificationCode;
            existingServer.name = payload.name.trim();
            existingServer.port = payload.port ?? 25565;
            existingServer.slogan = normalizeText(payload.slogan);
            existingServer.description = normalizeText(payload.description);
            existingServer.website = normalizeText(payload.website);
            existingServer.youtube = normalizeText(payload.youtube);
            existingServer.discord = normalizeText(payload.discord);
            existingServer.telegram = normalizeText(payload.telegram);
            existingServer.vk = normalizeText(payload.vk);
            existingServer.bannerUrl = normalizeArray(payload.banner)[0] ?? null;
            existingServer.logoUrl = normalizeArray(payload.logo)[0] ?? null;
            existingServer.categories = normalizeCategories(payload.categories);
            existingServer.imageUrls = normalizeArray(payload.images);
            existingServer.versions = normalizeVersions(payload.versions);
            existingServer.updatedAt = new Date();

            await this.serverRepository.save(existingServer);
            await this.invalidateServerCaches(existingServer, [existingServer.ownerUserId, owner.id]);

            const claimedServer = await this.getServerByIdOrSlug(existingServer.id);

            if (!claimedServer) {
                throw new AppError("Не удалось создать заявку на подтверждение сервера", 500);
            }

            return {
                server: this.serializeServer(claimedServer, undefined, owner.id),
                motdVerificationText: buildMotdVerificationText(motdVerificationCode),
            };
        }

        const server = this.serverRepository.create({
            id: randomUUID(),
            ownerUserId: owner.id,
            slug,
            name: payload.name.trim(),
            ip,
            port: payload.port ?? 25565,
            slogan: normalizeText(payload.slogan),
            description: normalizeText(payload.description),
            website: normalizeText(payload.website),
            youtube: normalizeText(payload.youtube),
            discord: normalizeText(payload.discord),
            telegram: normalizeText(payload.telegram),
            vk: normalizeText(payload.vk),
            bannerUrl: normalizeArray(payload.banner)[0] ?? null,
            logoUrl: normalizeArray(payload.logo)[0] ?? null,
            categories: normalizeCategories(payload.categories),
            imageUrls: normalizeArray(payload.images),
            versions: normalizeVersions(payload.versions),
            managers: [],
            rating: 0,
            isMotdVerified: false,
            motdVerificationCode,
            motdVerifiedAt: null,
            motdClaimUserId: null,
            motdClaimedAt: null,
            moderationStatus: EServerModerationStatus.MotdPending,
            moderationComment: null,
            reviewedByAccountId: null,
            reviewedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        await this.serverRepository.save(server);
        await this.invalidateServerCaches(server, [owner.id]);

        const createdServer = await this.getServerByIdOrSlug(server.id);

        if (!createdServer) {
            throw new AppError("Не удалось создать сервер", 500);
        }

        return {
            server: this.serializeServer(createdServer, undefined, account.userId),
            motdVerificationText: buildMotdVerificationText(motdVerificationCode),
        };
    }

    async getServerManagers(token: string | undefined, serverId: string) {
        const { server } = await this.getOwnedServer(token, serverId);
        return { managers: await this.hydrateManagers(this.normalizeManagers(server.managers)) };
    }

    async addServerManager(token: string | undefined, serverId: string, payload: ServerManagerPayload) {
        const { server } = await this.getOwnedServer(token, serverId);
        const email = normalizeEmail(payload.email);

        if (!isValidEmail(email)) {
            throw new AppError("Укажите корректный email менеджера", 400);
        }

        const account = await this.getAccountByEmail(email);

        if (!account) {
            throw new AppError("Пользователь с таким email не найден", 404);
        }

        const managers = this.normalizeManagers(server.managers);

        if (managers.length >= 5) {
            throw new AppError("Можно добавить не больше 5 менеджеров", 400);
        }

        if (managers.some((manager) => manager.email === email || manager.userId === account.userId)) {
            throw new AppError("Менеджер с таким email уже добавлен", 409);
        }

        managers.unshift({
            id: randomUUID(),
            userId: account.userId,
            email,
            createdAt: new Date().toISOString(),
        });

        server.managers = managers;
        server.updatedAt = new Date();
        await this.serverRepository.save(server);
        await this.invalidateServerCaches(server, [server.ownerUserId, account.userId]);

        return { managers: await this.hydrateManagers(this.normalizeManagers(server.managers)) };
    }

    async updateServer(token: string | undefined, serverId: string, payload: UpdateServerPayload) {
        const { account, server } = await this.getOwnedServer(token, serverId);

        if (server.motdClaimUserId && server.motdClaimUserId !== account.userId) {
            throw new AppError("На этот IP уже создана новая заявка на подтверждение", 409);
        }

        let shouldResetMotdVerification = false;

        if (payload.name !== undefined) {
            server.name = payload.name.trim();
        }

        if (payload.ip !== undefined) {
            const nextIp = normalizeIp(payload.ip);
            await this.ensureIpIsAvailable(nextIp, server.id);
            shouldResetMotdVerification = nextIp !== server.ip;
            server.ip = nextIp;
        }

        if (payload.port !== undefined) {
            shouldResetMotdVerification = shouldResetMotdVerification || payload.port !== server.port;
            server.port = payload.port;
        }

        if (payload.slogan !== undefined) {
            server.slogan = normalizeText(payload.slogan);
        }

        if (payload.description !== undefined) {
            server.description = normalizeText(payload.description);
        }

        if (payload.website !== undefined) {
            server.website = normalizeText(payload.website);
        }

        if (payload.youtube !== undefined) {
            server.youtube = normalizeText(payload.youtube);
        }

        if (payload.discord !== undefined) {
            server.discord = normalizeText(payload.discord);
        }

        if (payload.telegram !== undefined) {
            server.telegram = normalizeText(payload.telegram);
        }

        if (payload.vk !== undefined) {
            server.vk = normalizeText(payload.vk);
        }

        if (payload.banner !== undefined) {
            server.bannerUrl = normalizeArray(payload.banner)[0] ?? null;
        }

        if (payload.logo !== undefined) {
            server.logoUrl = normalizeArray(payload.logo)[0] ?? null;
        }

        if (payload.categories !== undefined) {
            server.categories = normalizeCategories(payload.categories);
        }

        if (payload.images !== undefined) {
            server.imageUrls = normalizeArray(payload.images);
        }

        if (payload.versions !== undefined) {
            server.versions = normalizeVersions(payload.versions);
        }

        if (shouldResetMotdVerification) {
            server.isMotdVerified = false;
            server.motdVerifiedAt = null;
            server.motdVerificationCode = buildMotdVerificationCode();
            server.motdClaimUserId = null;
            server.motdClaimedAt = null;
            server.moderationStatus = EServerModerationStatus.MotdPending;
            server.moderationComment = null;
            server.reviewedByAccountId = null;
            server.reviewedAt = null;
        } else if (server.moderationStatus === EServerModerationStatus.Rejected && server.isMotdVerified) {
            server.moderationStatus = EServerModerationStatus.ReviewPending;
            server.reviewedByAccountId = null;
            server.reviewedAt = null;
        }

        server.updatedAt = new Date();
        await this.serverRepository.save(server);
        await this.invalidateServerCaches(server, [
            server.ownerUserId,
            ...this.normalizeManagers(server.managers).map((manager) => manager.userId).filter(Boolean) as string[],
        ]);

        const savedServer = await this.getServerByIdOrSlug(server.id);

        if (!savedServer) {
            throw new AppError("Не удалось обновить сервер", 500);
        }

        const latestStatus = await this.getLatestStatusByServerIds([savedServer.id]);
        return { server: this.serializeServer(savedServer, latestStatus.get(savedServer.id), server.ownerUserId) };
    }

    async deleteServerManager(token: string | undefined, serverId: string, managerId: string) {
        const { server } = await this.getOwnedServer(token, serverId);
        const managers = this.normalizeManagers(server.managers);
        const nextManagers = managers.filter((manager) => manager.id !== managerId);

        if (nextManagers.length === managers.length) {
            throw new NotFoundError("Менеджер не найден");
        }

        server.managers = nextManagers;
        server.updatedAt = new Date();
        await this.serverRepository.save(server);
        const removedManager = managers.find((manager) => manager.id === managerId);
        await this.invalidateServerCaches(server, [
            server.ownerUserId,
            ...nextManagers.map((manager) => manager.userId).filter(Boolean) as string[],
            ...(removedManager?.userId ? [removedManager.userId] : []),
        ]);

        return { managers: await this.hydrateManagers(this.normalizeManagers(server.managers)) };
    }

    async confirmMotd(token: string | undefined, serverId: string) {
        const account = await this.getAccountFromAccessToken(token);
        const server = await this.getServerByIdOrSlug(serverId);

        if (!server) {
            throw new NotFoundError("Сервер не найден");
        }

        const isOwner = server.ownerUserId === account.userId;
        const isClaimOwner = server.motdClaimUserId === account.userId;

        if (!isOwner && !isClaimOwner) {
            throw new UnauthorizedError("Сервер не принадлежит текущему пользователю");
        }

        if (server.motdClaimUserId && !isClaimOwner) {
            throw new UnauthorizedError("На этот IP уже создана новая заявка на подтверждение");
        }

        if (server.moderationStatus === EServerModerationStatus.Rejected) {
            throw new AppError("Сервер отклонён модерацией. Отредактируйте данные перед повторной проверкой", 400);
        }

        if (server.moderationStatus === EServerModerationStatus.Approved) {
            const latestStatus = await this.getLatestStatusByServerIds([server.id]);
            return { server: this.serializeServer(server, latestStatus.get(server.id), server.ownerUserId) };
        }

        if (!server.motdVerificationCode) {
            server.motdVerificationCode = buildMotdVerificationCode();
            server.updatedAt = new Date();
            await this.serverRepository.save(server);
        }

        const scanner = new ServerScannerService(this.fastify);
        const scan = await scanner.scanSingleServer(server);

        if (!scan.isOnline) {
            throw new AppError("Сервер не отвечает. Проверьте IP, порт и доступность сервера", 400);
        }

        if (!scan.motd || !scan.motd.includes(server.motdVerificationCode)) {
            throw new AppError("Код подтверждения не найден в MOTD сервера", 400);
        }

        server.isMotdVerified = true;
        server.motdVerifiedAt = new Date();
        server.motdVerificationCode = null;
        server.ownerUserId = server.motdClaimUserId ?? server.ownerUserId;
        server.motdClaimUserId = null;
        server.motdClaimedAt = null;
        server.moderationStatus = EServerModerationStatus.ReviewPending;
        server.moderationComment = null;
        server.reviewedByAccountId = null;
        server.reviewedAt = null;
        server.updatedAt = new Date();

        await this.serverRepository.save(server);
        await this.invalidateServerCaches(server, [server.ownerUserId]);

        const savedServer = await this.getServerByIdOrSlug(server.id);

        if (!savedServer) {
            throw new AppError("Не удалось подтвердить сервер", 500);
        }

        const latestStatus = await this.getLatestStatusByServerIds([savedServer.id]);
        return { server: this.serializeServer(savedServer, latestStatus.get(savedServer.id), account.userId) };
    }

    async listAdminServers(token: string | undefined, query: AdminServerListQuery) {
        await this.getAdminAccountFromAccessToken(token);

        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
        const status = query.status ?? EServerModerationStatus.ReviewPending;
        const search = normalizeText(query.search);
        const qb = this.serverRepository
            .createQueryBuilder("server")
            .leftJoinAndSelect("server.owner", "owner")
            .where("server.moderationStatus = :status", { status })
            .orderBy("server.createdAt", "DESC")
            .skip((page - 1) * limit)
            .take(limit);

        if (search) {
            const searchPattern = `%${escapeLikePattern(search)}%`;

            qb.andWhere(
                `(
                    server.name ILIKE :searchPattern
                    OR server.slug ILIKE :searchPattern
                    OR server.ip ILIKE :searchPattern
                    OR COALESCE(server.slogan, '') ILIKE :searchPattern
                    OR COALESCE(server.description, '') ILIKE :searchPattern
                )`,
                { searchPattern },
            );
        }

        const [servers, total] = await qb.getManyAndCount();
        const latestStatus = await this.getLatestStatusByServerIds(servers.map((server) => server.id));

        return {
            items: servers.map((server) => this.serializeServer(server, latestStatus.get(server.id), server.ownerUserId)),
            page,
            limit,
            total,
            totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        };
    }

    async getAdminServer(token: string | undefined, serverId: string) {
        await this.getAdminAccountFromAccessToken(token);
        const server = await this.getServerByIdOrSlug(serverId);

        if (!server) {
            throw new NotFoundError("Сервер не найден");
        }

        const latestStatus = await this.getLatestStatusByServerIds([server.id]);
        return { server: this.serializeServer(server, latestStatus.get(server.id), server.ownerUserId) };
    }

    async updateAdminServer(token: string | undefined, serverId: string, payload: UpdateServerPayload) {
        await this.getAdminAccountFromAccessToken(token);
        const server = await this.getServerByIdOrSlug(serverId);

        if (!server) {
            throw new NotFoundError("Сервер не найден");
        }

        if (payload.name !== undefined) {
            server.name = payload.name.trim();
        }

        if (payload.slogan !== undefined) {
            server.slogan = normalizeText(payload.slogan);
        }

        if (payload.description !== undefined) {
            server.description = normalizeText(payload.description);
        }

        if (payload.website !== undefined) {
            server.website = normalizeText(payload.website);
        }

        if (payload.youtube !== undefined) {
            server.youtube = normalizeText(payload.youtube);
        }

        if (payload.discord !== undefined) {
            server.discord = normalizeText(payload.discord);
        }

        if (payload.telegram !== undefined) {
            server.telegram = normalizeText(payload.telegram);
        }

        if (payload.vk !== undefined) {
            server.vk = normalizeText(payload.vk);
        }

        if (payload.banner !== undefined) {
            server.bannerUrl = normalizeArray(payload.banner)[0] ?? null;
        }

        if (payload.logo !== undefined) {
            server.logoUrl = normalizeArray(payload.logo)[0] ?? null;
        }

        if (payload.categories !== undefined) {
            server.categories = normalizeCategories(payload.categories);
        }

        if (payload.images !== undefined) {
            server.imageUrls = normalizeArray(payload.images);
        }

        if (payload.versions !== undefined) {
            server.versions = normalizeVersions(payload.versions);
        }

        server.updatedAt = new Date();
        await this.serverRepository.save(server);
        await this.invalidateServerCaches(server, [server.ownerUserId]);

        const latestStatus = await this.getLatestStatusByServerIds([server.id]);
        return { server: this.serializeServer(server, latestStatus.get(server.id), server.ownerUserId) };
    }

    async approveAdminServer(token: string | undefined, serverId: string, payload: AdminServerReviewPayload = {}) {
        const admin = await this.getAdminAccountFromAccessToken(token);
        const server = await this.getServerByIdOrSlug(serverId);

        if (!server) {
            throw new NotFoundError("Сервер не найден");
        }

        if (!server.isMotdVerified) {
            throw new AppError("Сначала владелец должен подтвердить сервер через MOTD", 400);
        }

        server.ownerUserId = server.motdClaimUserId ?? server.ownerUserId;
        server.motdClaimUserId = null;
        server.motdClaimedAt = null;
        server.isMotdVerified = true;
        server.motdVerifiedAt = server.motdVerifiedAt ?? new Date();
        server.motdVerificationCode = null;
        server.moderationStatus = EServerModerationStatus.Approved;
        server.moderationComment = normalizeText(payload.comment);
        server.reviewedByAccountId = admin.id;
        server.reviewedAt = new Date();
        server.updatedAt = new Date();

        await this.serverRepository.save(server);
        await this.invalidateServerCaches(server, [server.ownerUserId]);

        const latestStatus = await this.getLatestStatusByServerIds([server.id]);
        return { server: this.serializeServer(server, latestStatus.get(server.id), server.ownerUserId) };
    }

    async rejectAdminServer(token: string | undefined, serverId: string, payload: AdminServerReviewPayload = {}) {
        const admin = await this.getAdminAccountFromAccessToken(token);
        const server = await this.getServerByIdOrSlug(serverId);

        if (!server) {
            throw new NotFoundError("Сервер не найден");
        }

        server.moderationStatus = EServerModerationStatus.Rejected;
        server.moderationComment = normalizeText(payload.comment);
        server.reviewedByAccountId = admin.id;
        server.reviewedAt = new Date();
        server.updatedAt = new Date();

        await this.serverRepository.save(server);
        await this.invalidateServerCaches(server, [server.ownerUserId]);

        const latestStatus = await this.getLatestStatusByServerIds([server.id]);
        return { server: this.serializeServer(server, latestStatus.get(server.id), server.ownerUserId) };
    }
}
