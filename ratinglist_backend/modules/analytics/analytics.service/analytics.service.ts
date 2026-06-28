import { createHash, randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import jwt, { JwtPayload } from "jsonwebtoken";
import { EntityManager } from "typeorm";

import { AccountEntity } from "../../../database/entities/account.entity";
import { ServerAnalyticsEntity } from "../../../database/entities/server-analytics.entity";
import { ServerVoteEntity } from "../../../database/entities/server-vote.entity";
import { EServerModerationStatus, ServerEntity } from "../../../database/entities/server.entity";
import { NotFoundError, UnauthorizedError } from "../../../errors/appErrors";
import { AnalyticsEventType, AnalyticsPeriod } from "../analytics.types";
import { getCachedJson, invalidateCacheNamespaces } from "../../../utils/cache";

const ANALYTICS_BUCKET_MS = 1000 * 60 * 5;
const VIEW_DEDUPE_SECONDS = 60 * 60;
const accessSecret = (process.env.JWT_SECRET ?? "") as string;

if (!accessSecret) {
    throw new Error("Критическая ошибка: JWT секрет не задан в .env");
}

const periodConfig: Record<AnalyticsPeriod, { durationMs: number; sqlBucket: string }> = {
    day: {
        durationMs: 1000 * 60 * 60 * 24,
        sqlBucket: `"bucketAt"`,
    },
    week: {
        durationMs: 1000 * 60 * 60 * 24 * 7,
        sqlBucket: `date_trunc('hour', "bucketAt")`,
    },
    month: {
        durationMs: 1000 * 60 * 60 * 24 * 30,
        sqlBucket: `date_trunc('day', "bucketAt")`,
    },
    year: {
        durationMs: 1000 * 60 * 60 * 24 * 365,
        sqlBucket: `date_trunc('month', "bucketAt")`,
    },
};

const eventColumn: Record<AnalyticsEventType, "viewsCount" | "ipCopiesCount" | "votesCount"> = {
    view: "viewsCount",
    "ip-copy": "ipCopiesCount",
    vote: "votesCount",
};

export function getAnalyticsBucketAt(date = new Date()): Date {
    return new Date(Math.floor(date.getTime() / ANALYTICS_BUCKET_MS) * ANALYTICS_BUCKET_MS);
}

function metric(value: string | number | null | undefined): number {
    return Number(value ?? 0);
}

function serializeLatestStatus(analytics: ServerAnalyticsEntity | null) {
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

export class AnalyticsService {
    constructor(private readonly fastify: FastifyInstance) {}

    private get accountRepository() {
        return this.fastify.dataSource.getRepository(AccountEntity);
    }

    private get analyticsRepository() {
        return this.fastify.dataSource.getRepository(ServerAnalyticsEntity);
    }

    private get serverRepository() {
        return this.fastify.dataSource.getRepository(ServerEntity);
    }

    private get voteRepository() {
        return this.fastify.dataSource.getRepository(ServerVoteEntity);
    }

    private async getAccountFromAccessToken(token?: string): Promise<AccountEntity> {
        if (!token) {
            throw new UnauthorizedError("Access token не предоставлен");
        }

        let decoded: JwtPayload;

        try {
            decoded = jwt.verify(token, accessSecret) as JwtPayload;
        } catch {
            throw new UnauthorizedError("Неверный или просроченный access token");
        }

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

    private async getPublicServer(serverId: string): Promise<ServerEntity> {
        const server = await this.getServerByIdOrSlug(serverId);

        if (!server || !server.isMotdVerified || server.moderationStatus !== EServerModerationStatus.Approved) {
            throw new NotFoundError("Сервер не найден");
        }

        return server;
    }

    private async getOwnedServer(serverId: string, token?: string): Promise<ServerEntity> {
        const [account, server] = await Promise.all([
            this.getAccountFromAccessToken(token),
            this.getServerByIdOrSlug(serverId),
        ]);

        if (!server) {
            throw new NotFoundError("Сервер не найден");
        }

        if (server.ownerUserId !== account.userId) {
            throw new UnauthorizedError("Сервер не принадлежит текущему пользователю");
        }

        return server;
    }

    private async getLatestStatus(serverId: string): Promise<ServerAnalyticsEntity | null> {
        return await this.analyticsRepository
            .createQueryBuilder("analytics")
            .where("analytics.serverId = :serverId", { serverId })
            .andWhere("analytics.scannedAt IS NOT NULL")
            .orderBy("analytics.bucketAt", "DESC")
            .getOne();
    }

    private async getPlayersRange(serverId: string, from: Date, to: Date, sqlBucket: string) {
        const rows = await this.fastify.dataSource.query<
            Array<{ time: Date | string; players: string | number; isOnline: boolean }>
        >(
            `
                SELECT
                    ${sqlBucket} AS "time",
                    COALESCE(ROUND(AVG("playersOnline") FILTER (WHERE "isOnline" = true)), 0)::integer AS "players",
                    BOOL_OR("isOnline") AS "isOnline"
                FROM "server_analytics"
                WHERE "serverId" = $1
                    AND "bucketAt" >= $2
                    AND "bucketAt" < $3
                    AND "scannedAt" IS NOT NULL
                GROUP BY ${sqlBucket}
                ORDER BY ${sqlBucket} ASC
            `,
            [serverId, from, to],
        );

        return rows.map((row) => ({
            time: new Date(row.time).toISOString(),
            players: metric(row.players),
            isOnline: row.isOnline,
        }));
    }

    async getPlayersAnalytics(serverId: string, period: AnalyticsPeriod) {
        const server = await this.getPublicServer(serverId);
        return await getCachedJson(this.fastify, `analytics:players:${server.id}`, { period }, 60, async () => {
            const config = periodConfig[period];
            const now = new Date();
            const currentFrom = new Date(now.getTime() - config.durationMs);
            const previousFrom = new Date(currentFrom.getTime() - config.durationMs);
            const [currentData, previousData] = await Promise.all([
                this.getPlayersRange(server.id, currentFrom, now, config.sqlBucket),
                this.getPlayersRange(server.id, previousFrom, currentFrom, config.sqlBucket),
            ]);

            return {
                currentData,
                previousData,
            };
        });
    }

    async getDashboardSummary(serverId: string, token?: string) {
        const server = await this.getOwnedServer(serverId, token);
        return await getCachedJson(this.fastify, `analytics:summary:${server.id}`, {}, 30, async () => {
            const now = new Date();
            const currentFrom = new Date(now.getTime() - periodConfig.day.durationMs);
            const previousFrom = new Date(currentFrom.getTime() - periodConfig.day.durationMs);

            const [latestStatus, rank, eventTotals, voteTotals] = await Promise.all([
                this.getLatestStatus(server.id),
                this.serverRepository
                    .createQueryBuilder("server")
                    .where("server.isMotdVerified = :isMotdVerified", { isMotdVerified: true })
                    .andWhere("server.moderationStatus = :moderationStatus", {
                        moderationStatus: EServerModerationStatus.Approved,
                    })
                    .andWhere("server.rating > :rating", { rating: server.rating })
                    .getCount(),
                this.analyticsRepository
                    .createQueryBuilder("analytics")
                    .select(`COALESCE(SUM(analytics.viewsCount) FILTER (WHERE analytics.bucketAt >= :currentFrom), 0)`, "currentViews")
                    .addSelect(`COALESCE(SUM(analytics.viewsCount) FILTER (WHERE analytics.bucketAt < :currentFrom), 0)`, "previousViews")
                    .addSelect(`COALESCE(SUM(analytics.ipCopiesCount) FILTER (WHERE analytics.bucketAt >= :currentFrom), 0)`, "currentIpCopies")
                    .addSelect(`COALESCE(SUM(analytics.ipCopiesCount) FILTER (WHERE analytics.bucketAt < :currentFrom), 0)`, "previousIpCopies")
                    .where("analytics.serverId = :serverId", { serverId: server.id })
                    .andWhere("analytics.bucketAt >= :previousFrom", { previousFrom })
                    .andWhere("analytics.bucketAt < :now", { now })
                    .setParameter("currentFrom", currentFrom)
                    .getRawOne<{
                        currentViews: string;
                        previousViews: string;
                        currentIpCopies: string;
                        previousIpCopies: string;
                    }>(),
                this.voteRepository
                    .createQueryBuilder("vote")
                    .select(`COUNT(vote.id) FILTER (WHERE vote.createdAt >= :currentFrom)`, "currentVotes")
                    .addSelect(`COUNT(vote.id) FILTER (WHERE vote.createdAt < :currentFrom)`, "previousVotes")
                    .where("vote.serverId = :serverId", { serverId: server.id })
                    .andWhere("vote.createdAt >= :previousFrom", { previousFrom })
                    .andWhere("vote.createdAt < :now", { now })
                    .setParameter("currentFrom", currentFrom)
                    .getRawOne<{ currentVotes: string; previousVotes: string }>(),
            ]);

            const currentViews = metric(eventTotals?.currentViews);
            const previousViews = metric(eventTotals?.previousViews);
            const currentIpCopies = metric(eventTotals?.currentIpCopies);
            const previousIpCopies = metric(eventTotals?.previousIpCopies);
            const currentVotes = metric(voteTotals?.currentVotes);
            const previousVotes = metric(voteTotals?.previousVotes);

            return {
                server: {
                    id: server.id,
                    slug: server.slug,
                    name: server.name,
                },
                latestStatus: serializeLatestStatus(latestStatus),
                position: rank + 1,
                views: {
                    value: currentViews,
                    trend: currentViews - previousViews,
                },
                ipCopies: {
                    value: currentIpCopies,
                    trend: currentIpCopies - previousIpCopies,
                },
                votes: {
                    value: currentVotes,
                    trend: currentVotes - previousVotes,
                },
            };
        });
    }

    async recordEventForServer(
        serverId: string,
        eventType: AnalyticsEventType,
        manager: EntityManager = this.fastify.dataSource.manager,
    ) {
        const column = eventColumn[eventType];

        await manager.query(
            `
                INSERT INTO "server_analytics" (
                    "id", "serverId", "bucketAt", "${column}", "updatedAt"
                )
                VALUES ($1, $2, $3, 1, CURRENT_TIMESTAMP)
                ON CONFLICT ("serverId", "bucketAt")
                DO UPDATE SET
                    "${column}" = "server_analytics"."${column}" + 1,
                    "updatedAt" = CURRENT_TIMESTAMP
            `,
            [randomUUID(), serverId, getAnalyticsBucketAt()],
        );
    }

    async recordView(serverId: string, visitorId: string) {
        const server = await this.getPublicServer(serverId);
        const visitorHash = createHash("sha256")
            .update(`${server.id}:${visitorId}`)
            .digest("hex");
        let shouldRecord = true;

        try {
            const result = await this.fastify.redis.set(`analytics:view:${visitorHash}`, "1", {
                EX: VIEW_DEDUPE_SECONDS,
                NX: true,
            });
            shouldRecord = result === "OK";
        } catch (error) {
            console.error("Не удалось проверить дедупликацию просмотра:", error);
        }

        if (shouldRecord) {
            await this.recordEventForServer(server.id, "view");
            await invalidateCacheNamespaces(this.fastify, [`analytics:summary:${server.id}`]);
        }

        return {
            success: true,
            recorded: shouldRecord,
        };
    }

    async recordIpCopy(serverId: string) {
        const server = await this.getPublicServer(serverId);
        await this.recordEventForServer(server.id, "ip-copy");
        await invalidateCacheNamespaces(this.fastify, [`analytics:summary:${server.id}`]);

        return {
            success: true,
        };
    }
}
