import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import jwt, { JwtPayload } from "jsonwebtoken";

import { AccountEntity } from "../../../database/entities/account.entity";
import { ServerVoteEntity } from "../../../database/entities/server-vote.entity";
import { ServerEntity } from "../../../database/entities/server.entity";
import { UserEntity } from "../../../database/entities/users.entity";
import { AppError, NotFoundError, UnauthorizedError } from "../../../errors/appErrors";
import { AnalyticsService } from "../../analytics/analytics.service/analytics.service";
import { VoteListQuery, VoteServerResponse, VoteUserState } from "../votes.types";
import { getCachedJson, invalidateCacheNamespaces } from "../../../utils/cache";

const accessSecret = (process.env.JWT_SECRET ?? "") as string;
const VOTE_COOLDOWN_MS = 1000 * 60 * 60 * 24;

if (!accessSecret) {
    throw new Error("Критическая ошибка: JWT секрет не задан в .env");
}

function displayName(user: UserEntity): string {
    const directName = user.username?.trim();
    const composedName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    return directName || composedName || "Пользователь";
}

function formatDate(date: Date | null): string | null {
    return date ? date.toISOString() : null;
}

function formatUserState(lastVoteAt: Date | null): VoteUserState {
    if (!lastVoteAt) {
        return {
            hasSession: true,
            canVote: true,
            lastVoteAt: null,
            nextVoteAt: null,
            cooldownSecondsLeft: 0,
        };
    }

    const nextVoteAt = new Date(lastVoteAt.getTime() + VOTE_COOLDOWN_MS);
    const cooldownSecondsLeft = Math.max(0, Math.ceil((nextVoteAt.getTime() - Date.now()) / 1000));

    return {
        hasSession: true,
        canVote: cooldownSecondsLeft === 0,
        lastVoteAt: lastVoteAt.toISOString(),
        nextVoteAt: nextVoteAt.toISOString(),
        cooldownSecondsLeft,
    };
}

export class VotesService {
    constructor(private readonly fastify: FastifyInstance) {}

    private get accountRepository() {
        return this.fastify.dataSource.getRepository(AccountEntity);
    }

    private get serverRepository() {
        return this.fastify.dataSource.getRepository(ServerEntity);
    }

    private get voteRepository() {
        return this.fastify.dataSource.getRepository(ServerVoteEntity);
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

    private async getAccountFromAccessToken(token?: string): Promise<AccountEntity | null> {
        if (!token) {
            return null;
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

    private async getServerByIdOrSlug(serverId: string): Promise<ServerEntity | null> {
        return await this.serverRepository.findOne({
            where: [{ id: serverId }, { slug: serverId }],
        });
    }

    private async getServerOrFail(serverId: string): Promise<ServerEntity> {
        const server = await this.getServerByIdOrSlug(serverId);

        if (!server) {
            throw new NotFoundError("Сервер не найден");
        }

        return server;
    }

    private async getUserOrFail(userId: string): Promise<UserEntity> {
        const user = await this.userRepository.findOne({ where: { id: userId } });

        if (!user) {
            throw new NotFoundError("Пользователь не найден");
        }

        return user;
    }

    private serializeServer(server: ServerEntity) {
        return {
            id: server.id,
            slug: server.slug,
            name: server.name,
            rating: server.rating,
        };
    }

    private async getCurrentUserState(serverId: string, userId?: string): Promise<VoteUserState> {
        if (!userId) {
            return {
                hasSession: false,
                canVote: false,
                lastVoteAt: null,
                nextVoteAt: null,
                cooldownSecondsLeft: 0,
            };
        }

        const lastVote = await this.voteRepository
            .createQueryBuilder("vote")
            .where("vote.serverId = :serverId", { serverId })
            .andWhere("vote.userId = :userId", { userId })
            .orderBy("vote.createdAt", "DESC")
            .getOne();

        return formatUserState(lastVote?.createdAt ?? null);
    }

    private async getSummary(serverId: string) {
        return await getCachedJson(this.fastify, `votes:summary:${serverId}`, {}, 60, async () => {
            const totals = await this.voteRepository
                .createQueryBuilder("vote")
                .select("COUNT(vote.id)", "totalVotes")
                .addSelect("COUNT(DISTINCT vote.userId)", "uniqueVoters")
                .addSelect("MAX(vote.createdAt)", "latestVoteAt")
                .where("vote.serverId = :serverId", { serverId })
                .getRawOne<{ totalVotes: string; uniqueVoters: string; latestVoteAt: Date | string | null }>();

            return {
                totalVotes: Number(totals?.totalVotes ?? 0),
                uniqueVoters: Number(totals?.uniqueVoters ?? 0),
                latestVoteAt: totals?.latestVoteAt ? new Date(totals.latestVoteAt).toISOString() : null,
            };
        });
    }

    private async getLeaderboard(serverId: string, page: number, limit: number) {
        return await getCachedJson(this.fastify, "votes:leaderboard", { serverId, page, limit }, 60, async () => {
            const qb = this.voteRepository
                .createQueryBuilder("vote")
                .leftJoin("vote.user", "user")
                .select("vote.userId", "userId")
                .addSelect("COUNT(vote.id)", "votes")
                .addSelect("MAX(vote.createdAt)", "lastVoteAt")
                .addSelect("user.username", "username")
                .addSelect("user.firstName", "firstName")
                .addSelect("user.lastName", "lastName")
                .addSelect("user.avatarUrl", "avatarUrl")
                .where("vote.serverId = :serverId", { serverId })
                .groupBy("vote.userId")
                .addGroupBy("user.username")
                .addGroupBy("user.firstName")
                .addGroupBy("user.lastName")
                .addGroupBy("user.avatarUrl")
                .orderBy("COUNT(vote.id)", "DESC")
                .addOrderBy("MAX(vote.createdAt)", "DESC")
                .skip((page - 1) * limit)
                .take(limit);

            const [rows, total] = await Promise.all([
                qb.getRawMany<{
                    userId: string;
                    votes: string;
                    lastVoteAt: Date | string;
                    username: string | null;
                    firstName: string | null;
                    lastName: string | null;
                    avatarUrl: string | null;
                }>(),
                this.voteRepository
                    .createQueryBuilder("vote")
                    .select("COUNT(DISTINCT vote.userId)", "total")
                    .where("vote.serverId = :serverId", { serverId })
                    .getRawOne<{ total: string }>(),
            ]);

            return {
                items: rows.map((row) => ({
                    id: row.userId,
                    userId: row.userId,
                    userName: row.username?.trim() || [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || "Пользователь",
                    userAvatarUrl: row.avatarUrl,
                    votes: Number(row.votes ?? 0),
                    lastVoteAt: new Date(row.lastVoteAt).toISOString(),
                })),
                total: Number(total?.total ?? 0),
            };
        });
    }

    async getServerVotes(serverId: string, query: VoteListQuery, token?: string): Promise<VoteServerResponse> {
        const server = await this.getServerOrFail(serverId);
        const account = token ? await this.getAccountFromAccessToken(token).catch(() => null) : null;
        const userState = await this.getCurrentUserState(server.id, account?.userId);
        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(Math.max(query.limit ?? 10, 1), 50);
        const [summary, leaderboard] = await Promise.all([
            this.getSummary(server.id),
            this.getLeaderboard(server.id, page, limit),
        ]);

        return {
            server: this.serializeServer(server),
            summary,
            userState,
            items: leaderboard.items,
            page,
            limit,
            total: leaderboard.total,
            totalPages: leaderboard.total === 0 ? 0 : Math.ceil(leaderboard.total / limit),
        };
    }

    async createVote(serverId: string, token?: string): Promise<VoteServerResponse> {
        const account = await this.getAccountFromAccessToken(token);

        if (!account) {
            throw new UnauthorizedError("Нужно войти в аккаунт, чтобы голосовать");
        }

        const server = await this.getServerOrFail(serverId);
        const user = await this.getUserOrFail(account.userId);
        const queryRunner = this.fastify.dataSource.createQueryRunner();

        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const lockedServer = await queryRunner.manager.findOne(ServerEntity, {
                where: { id: server.id },
                lock: { mode: "pessimistic_write" },
            });

            if (!lockedServer) {
                throw new NotFoundError("Сервер не найден");
            }

            const lastVote = await queryRunner.manager.findOne(ServerVoteEntity, {
                where: {
                    serverId: lockedServer.id,
                    userId: user.id,
                },
                order: { createdAt: "DESC" },
            });

            if (lastVote) {
                const nextVoteAt = new Date(lastVote.createdAt.getTime() + VOTE_COOLDOWN_MS);

                if (nextVoteAt.getTime() > Date.now()) {
                    const remainingMs = nextVoteAt.getTime() - Date.now();
                    const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
                    throw new AppError(`Голосовать можно только раз в 24 часа. Попробуйте снова через ${remainingMinutes} мин.`, 429);
                }
            }

            const vote = queryRunner.manager.create(ServerVoteEntity, {
                id: randomUUID(),
                serverId: lockedServer.id,
                userId: user.id,
                createdAt: new Date(),
            });

            await queryRunner.manager.save(vote);

            lockedServer.rating += 1;
            await queryRunner.manager.save(lockedServer);
            await new AnalyticsService(this.fastify).recordEventForServer(lockedServer.id, "vote", queryRunner.manager);

            await queryRunner.commitTransaction();
            await invalidateCacheNamespaces(this.fastify, [
                `votes:summary:${lockedServer.id}`,
                "votes:leaderboard",
                `analytics:summary:${lockedServer.id}`,
                "servers:list",
                "servers:search",
                "servers:detail",
                "servers:user",
            ]);
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }

        return await this.getServerVotes(server.id, { page: 1, limit: 10 }, token);
    }
}
