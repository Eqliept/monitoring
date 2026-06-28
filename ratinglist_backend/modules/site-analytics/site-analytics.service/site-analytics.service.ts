import { createHash, randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import jwt, { JwtPayload } from "jsonwebtoken";

import { AccountEntity } from "../../../database/entities/account.entity";
import { BalanceTopUpEntity, EBalanceTopUpStatus } from "../../../database/entities/balance-top-up.entity";
import { SiteVisitSessionEntity } from "../../../database/entities/site-visit-session.entity";
import { UserEntity } from "../../../database/entities/users.entity";
import { BadRequestError, NotFoundError } from "../../../errors/appErrors";
import {
    SiteAnalyticsHeartbeatBody,
    SiteAnalyticsOverviewQuery,
    SiteAnalyticsPeriod,
    SiteAnalyticsRecentTopUpsQuery,
    SiteAnalyticsSessionBody,
} from "../site-analytics.types";

const HEARTBEAT_MAX_GAP_SECONDS = 90;
const SESSION_MAX_DURATION_SECONDS = 60 * 60 * 2;
const SESSION_CACHE_TTL_SECONDS = SESSION_MAX_DURATION_SECONDS + 60 * 60;
const SESSION_FLUSH_DELAY_SECONDS = 30;
const SESSION_FLUSH_BATCH_SIZE = 100;
const DEFAULT_VISITOR_ID = "anonymous";
const SESSION_CACHE_KEY_PREFIX = "site-analytics:session";
const SESSION_FLUSH_ZSET_KEY = "site-analytics:sessions:flush";

interface CachedVisitSession {
    id: string;
    visitorHash: string;
    accountId: string | null;
    userId: string | null;
    startedAt: string;
    lastSeenAt: string;
    durationSeconds: number;
    pageViewsCount: number;
    entryPath: string | null;
    lastPath: string | null;
    referrer: string | null;
    userAgentHash: string | null;
    ipHash: string | null;
    createdAt: string;
    updatedAt: string;
    updatedAtMs: number;
}

const periodConfig: Record<SiteAnalyticsPeriod, { durationMs: number; sessionSqlBucket: string; userSqlBucket: string }> = {
    "7d": {
        durationMs: 1000 * 60 * 60 * 24 * 7,
        sessionSqlBucket: `date_trunc('day', "startedAt")`,
        userSqlBucket: `date_trunc('day', "createdAt")`,
    },
    "30d": {
        durationMs: 1000 * 60 * 60 * 24 * 30,
        sessionSqlBucket: `date_trunc('day', "startedAt")`,
        userSqlBucket: `date_trunc('day', "createdAt")`,
    },
    "90d": {
        durationMs: 1000 * 60 * 60 * 24 * 90,
        sessionSqlBucket: `date_trunc('day', "startedAt")`,
        userSqlBucket: `date_trunc('day', "createdAt")`,
    },
    "12m": {
        durationMs: 1000 * 60 * 60 * 24 * 365,
        sessionSqlBucket: `date_trunc('month', "startedAt")`,
        userSqlBucket: `date_trunc('month', "createdAt")`,
    },
};

function hashValue(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

function sanitizeText(value: string | undefined, maxLength: number): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed.slice(0, maxLength) : null;
}

function metric(value: string | number | null | undefined): number {
    return Number(value ?? 0);
}

function trendPercent(currentValue: number, previousValue: number): number {
    if (previousValue === 0) {
        return currentValue > 0 ? 100 : 0;
    }

    return ((currentValue - previousValue) / previousValue) * 100;
}

function sessionCacheKey(sessionId: string): string {
    return `${SESSION_CACHE_KEY_PREFIX}:${sessionId}`;
}

function buildFlushMember(session: CachedVisitSession): string {
    return `${session.id}:${session.updatedAtMs}`;
}

function parseFlushMember(member: string): { sessionId: string; updatedAtMs: number } | null {
    const separatorIndex = member.lastIndexOf(":");

    if (separatorIndex <= 0) {
        return null;
    }

    const sessionId = member.slice(0, separatorIndex);
    const updatedAtMs = Number(member.slice(separatorIndex + 1));

    return sessionId && Number.isFinite(updatedAtMs) ? { sessionId, updatedAtMs } : null;
}

function parseCachedVisitSession(value: string | null): CachedVisitSession | null {
    if (!value) {
        return null;
    }

    try {
        const parsed = JSON.parse(value) as Partial<CachedVisitSession>;

        if (!parsed.id || !parsed.visitorHash || !parsed.startedAt || !parsed.lastSeenAt) {
            return null;
        }

        const updatedAt = parsed.updatedAt ?? parsed.lastSeenAt;
        const updatedAtMs = Number(parsed.updatedAtMs ?? new Date(updatedAt).getTime());

        if (!Number.isFinite(updatedAtMs)) {
            return null;
        }

        return {
            id: parsed.id,
            visitorHash: parsed.visitorHash,
            accountId: parsed.accountId ?? null,
            userId: parsed.userId ?? null,
            startedAt: parsed.startedAt,
            lastSeenAt: parsed.lastSeenAt,
            durationSeconds: metric(parsed.durationSeconds),
            pageViewsCount: metric(parsed.pageViewsCount) || 1,
            entryPath: parsed.entryPath ?? null,
            lastPath: parsed.lastPath ?? null,
            referrer: parsed.referrer ?? null,
            userAgentHash: parsed.userAgentHash ?? null,
            ipHash: parsed.ipHash ?? null,
            createdAt: parsed.createdAt ?? parsed.startedAt,
            updatedAt,
            updatedAtMs,
        };
    } catch {
        return null;
    }
}

function reportRedisBufferError(fastify: FastifyInstance, operation: string, error: unknown) {
    fastify.log.warn({ err: error, operation }, "Site analytics Redis buffer failed");
}

export class SiteAnalyticsService {
    constructor(private readonly fastify: FastifyInstance) {}

    private get accountRepository() {
        return this.fastify.dataSource.getRepository(AccountEntity);
    }

    private get sessionRepository() {
        return this.fastify.dataSource.getRepository(SiteVisitSessionEntity);
    }

    private get topUpRepository() {
        return this.fastify.dataSource.getRepository(BalanceTopUpEntity);
    }

    private get userRepository() {
        return this.fastify.dataSource.getRepository(UserEntity);
    }

    private async getCachedSession(sessionId: string): Promise<CachedVisitSession | null> {
        if (!this.fastify.redis.isReady) {
            return null;
        }

        try {
            const cached = await this.fastify.redis.get(sessionCacheKey(sessionId));
            const session = parseCachedVisitSession(cached);

            if (!session && cached !== null) {
                await this.fastify.redis.del(sessionCacheKey(sessionId)).catch(() => undefined);
            }

            return session;
        } catch (error) {
            reportRedisBufferError(this.fastify, "get-session", error);
            return null;
        }
    }

    private async bufferSessionForFlush(session: CachedVisitSession): Promise<boolean> {
        if (!this.fastify.redis.isReady) {
            return false;
        }

        try {
            await this.fastify.redis.set(sessionCacheKey(session.id), JSON.stringify(session), {
                EX: SESSION_CACHE_TTL_SECONDS,
            });
            await this.fastify.redis.zAdd(SESSION_FLUSH_ZSET_KEY, {
                score: Date.now() + SESSION_FLUSH_DELAY_SECONDS * 1000,
                value: buildFlushMember(session),
            });

            return true;
        } catch (error) {
            reportRedisBufferError(this.fastify, "buffer-session", error);
            return false;
        }
    }

    private async persistCachedSessions(sessions: CachedVisitSession[]): Promise<void> {
        if (sessions.length === 0) {
            return;
        }

        await this.sessionRepository.upsert(
            sessions.map((session) => ({
                id: session.id,
                visitorHash: session.visitorHash,
                accountId: session.accountId,
                userId: session.userId,
                startedAt: new Date(session.startedAt),
                lastSeenAt: new Date(session.lastSeenAt),
                durationSeconds: session.durationSeconds,
                pageViewsCount: session.pageViewsCount,
                entryPath: session.entryPath,
                lastPath: session.lastPath,
                referrer: session.referrer,
                userAgentHash: session.userAgentHash,
                ipHash: session.ipHash,
                createdAt: new Date(session.createdAt),
                updatedAt: new Date(session.updatedAt),
            })),
            ["id"],
        );
    }

    private async getAccountFromOptionalAccessToken(token?: string): Promise<AccountEntity | null> {
        const accessSecret = process.env.JWT_SECRET ?? "";

        if (!token || !accessSecret) {
            return null;
        }

        try {
            const decoded = jwt.verify(token, accessSecret) as JwtPayload;
            const subject = decoded.sub as string | undefined;

            if (!subject) {
                return null;
            }

            return await this.accountRepository.findOne({ where: { id: subject } });
        } catch {
            return null;
        }
    }

    async startSession(
        body: SiteAnalyticsSessionBody | undefined,
        options: { accessToken?: string; ip?: string; userAgent?: string },
    ) {
        const now = new Date();
        const visitorId = body?.visitorId || options.ip || DEFAULT_VISITOR_ID;
        const account = await this.getAccountFromOptionalAccessToken(options.accessToken);
        const session: CachedVisitSession = {
            id: randomUUID(),
            visitorHash: hashValue(visitorId),
            accountId: account?.id ?? null,
            userId: account?.userId ?? null,
            startedAt: now.toISOString(),
            lastSeenAt: now.toISOString(),
            durationSeconds: 0,
            pageViewsCount: 1,
            entryPath: sanitizeText(body?.path, 500),
            lastPath: sanitizeText(body?.path, 500),
            referrer: sanitizeText(body?.referrer, 1000),
            userAgentHash: options.userAgent ? hashValue(options.userAgent) : null,
            ipHash: options.ip ? hashValue(options.ip) : null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            updatedAtMs: now.getTime(),
        };

        const buffered = await this.bufferSessionForFlush(session);

        if (!buffered) {
            await this.persistCachedSessions([session]);
        }

        return {
            sessionId: session.id,
            startedAt: session.startedAt,
        };
    }

    async recordHeartbeat(sessionId: string, body: SiteAnalyticsHeartbeatBody | undefined) {
        const cachedSession = await this.getCachedSession(sessionId);

        if (cachedSession) {
            if (body?.visitorId && hashValue(body.visitorId) !== cachedSession.visitorHash) {
                throw new BadRequestError("Visitor id не совпадает с сессией аналитики");
            }

            const now = new Date();
            const lastSeenAt = new Date(cachedSession.lastSeenAt);
            const gapSeconds = Math.max(0, Math.floor((now.getTime() - lastSeenAt.getTime()) / 1000));
            const countedSeconds = gapSeconds <= HEARTBEAT_MAX_GAP_SECONDS ? gapSeconds : 0;
            const nextPath = sanitizeText(body?.path, 500);
            const nextSession: CachedVisitSession = {
                ...cachedSession,
                durationSeconds: Math.min(
                    SESSION_MAX_DURATION_SECONDS,
                    cachedSession.durationSeconds + countedSeconds,
                ),
                pageViewsCount: cachedSession.pageViewsCount + (nextPath && nextPath !== cachedSession.lastPath ? 1 : 0),
                lastPath: nextPath ?? cachedSession.lastPath,
                lastSeenAt: now.toISOString(),
                updatedAt: now.toISOString(),
                updatedAtMs: now.getTime(),
            };
            const buffered = await this.bufferSessionForFlush(nextSession);

            if (!buffered) {
                await this.persistCachedSessions([nextSession]);
            }

            return {
                success: true,
                durationSeconds: nextSession.durationSeconds,
            };
        }

        const session = await this.sessionRepository.findOne({ where: { id: sessionId } });

        if (!session) {
            throw new NotFoundError("Сессия аналитики не найдена");
        }

        if (body?.visitorId && hashValue(body.visitorId) !== session.visitorHash) {
            throw new BadRequestError("Visitor id не совпадает с сессией аналитики");
        }

        const now = new Date();
        const gapSeconds = Math.max(0, Math.floor((now.getTime() - session.lastSeenAt.getTime()) / 1000));
        const countedSeconds = gapSeconds <= HEARTBEAT_MAX_GAP_SECONDS ? gapSeconds : 0;
        const nextDuration = Math.min(
            SESSION_MAX_DURATION_SECONDS,
            session.durationSeconds + countedSeconds,
        );
        const nextPath = sanitizeText(body?.path, 500);

        session.durationSeconds = nextDuration;
        session.pageViewsCount += nextPath && nextPath !== session.lastPath ? 1 : 0;
        session.lastPath = nextPath ?? session.lastPath;
        session.lastSeenAt = now;
        session.updatedAt = now;

        await this.sessionRepository.save(session);

        return {
            success: true,
            durationSeconds: session.durationSeconds,
        };
    }

    async flushDueSessions(limit: number = SESSION_FLUSH_BATCH_SIZE) {
        if (!this.fastify.redis.isReady) {
            return { persisted: 0, skipped: 0 };
        }

        const dueMembers = await this.fastify.redis.zRangeByScore(SESSION_FLUSH_ZSET_KEY, 0, Date.now(), {
            LIMIT: {
                offset: 0,
                count: limit,
            },
        });

        if (dueMembers.length === 0) {
            return { persisted: 0, skipped: 0 };
        }

        const sessionsToPersist = new Map<string, CachedVisitSession>();
        const membersToRemove: string[] = [];
        let skipped = 0;

        for (const member of dueMembers) {
            const memberValue = String(member);
            const parsed = parseFlushMember(memberValue);
            membersToRemove.push(memberValue);

            if (!parsed) {
                skipped += 1;
                continue;
            }

            const session = await this.getCachedSession(parsed.sessionId);

            if (!session || session.updatedAtMs > parsed.updatedAtMs) {
                skipped += 1;
                continue;
            }

            sessionsToPersist.set(session.id, session);
        }

        const sessions = Array.from(sessionsToPersist.values());
        await this.persistCachedSessions(sessions);

        if (membersToRemove.length > 0) {
            await this.fastify.redis.zRem(SESSION_FLUSH_ZSET_KEY, membersToRemove);
        }

        return {
            persisted: sessions.length,
            skipped,
        };
    }

    private async getSessionMetrics(from: Date, to: Date) {
        return await this.sessionRepository
            .createQueryBuilder("session")
            .select("COUNT(session.id)", "visits")
            .addSelect("COALESCE(AVG(session.durationSeconds), 0)", "averageTimeSeconds")
            .where("session.startedAt >= :from", { from })
            .andWhere("session.startedAt < :to", { to })
            .getRawOne<{ visits: string; averageTimeSeconds: string }>();
    }

    private async getRegistrationsCount(from: Date, to: Date) {
        return await this.userRepository
            .createQueryBuilder("user")
            .where("user.createdAt >= :from", { from })
            .andWhere("user.createdAt < :to", { to })
            .getCount();
    }

    private async getRevenueRub(from: Date, to: Date) {
        const paidStatuses = [
            EBalanceTopUpStatus.Paid,
            EBalanceTopUpStatus.Overpaid,
            EBalanceTopUpStatus.Partial,
        ];
        const row = await this.topUpRepository
            .createQueryBuilder("topUp")
            .select("COALESCE(SUM(topUp.creditedAmountRub), 0)", "revenueRub")
            .where("topUp.status IN (:...paidStatuses)", { paidStatuses })
            .andWhere("topUp.paidAt >= :from", { from })
            .andWhere("topUp.paidAt < :to", { to })
            .getRawOne<{ revenueRub: string }>();

        return metric(row?.revenueRub);
    }

    async getOverview(query: SiteAnalyticsOverviewQuery) {
        try {
            await this.flushDueSessions();
        } catch (error) {
            reportRedisBufferError(this.fastify, "flush-before-overview", error);
        }

        const period = query.period ?? "30d";
        const config = periodConfig[period];
        const now = new Date();
        const currentFrom = new Date(now.getTime() - config.durationMs);
        const previousFrom = new Date(currentFrom.getTime() - config.durationMs);

        const [
            currentSessions,
            previousSessions,
            currentRegistrations,
            previousRegistrations,
            currentRevenueRub,
            previousRevenueRub,
            sessionPoints,
            registrationPoints,
        ] = await Promise.all([
            this.getSessionMetrics(currentFrom, now),
            this.getSessionMetrics(previousFrom, currentFrom),
            this.getRegistrationsCount(currentFrom, now),
            this.getRegistrationsCount(previousFrom, currentFrom),
            this.getRevenueRub(currentFrom, now),
            this.getRevenueRub(previousFrom, currentFrom),
            this.fastify.dataSource.query<
                Array<{ time: Date | string; visits: string | number }>
            >(
                `
                    SELECT
                        ${config.sessionSqlBucket} AS "time",
                        COUNT("id")::integer AS "visits"
                    FROM "site_visit_sessions"
                    WHERE "startedAt" >= $1
                        AND "startedAt" < $2
                    GROUP BY ${config.sessionSqlBucket}
                    ORDER BY ${config.sessionSqlBucket} ASC
                `,
                [currentFrom, now],
            ),
            this.fastify.dataSource.query<
                Array<{ time: Date | string; registrations: string | number }>
            >(
                `
                    SELECT
                        ${config.userSqlBucket} AS "time",
                        COUNT("id")::integer AS "registrations"
                    FROM "users"
                    WHERE "createdAt" >= $1
                        AND "createdAt" < $2
                    GROUP BY ${config.userSqlBucket}
                    ORDER BY ${config.userSqlBucket} ASC
                `,
                [currentFrom, now],
            ),
        ]);

        const currentVisits = metric(currentSessions?.visits);
        const previousVisits = metric(previousSessions?.visits);
        const currentAverageTimeSeconds = Math.round(metric(currentSessions?.averageTimeSeconds));
        const previousAverageTimeSeconds = Math.round(metric(previousSessions?.averageTimeSeconds));

        const pointMap = new Map<string, { time: string; visits: number; registrations: number }>();

        for (const point of sessionPoints) {
            const time = new Date(point.time).toISOString();
            pointMap.set(time, {
                time,
                visits: metric(point.visits),
                registrations: 0,
            });
        }

        for (const point of registrationPoints) {
            const time = new Date(point.time).toISOString();
            const currentPoint = pointMap.get(time) ?? {
                time,
                visits: 0,
                registrations: 0,
            };

            currentPoint.registrations = metric(point.registrations);
            pointMap.set(time, currentPoint);
        }

        return {
            period,
            range: {
                from: currentFrom.toISOString(),
                to: now.toISOString(),
                previousFrom: previousFrom.toISOString(),
                previousTo: currentFrom.toISOString(),
            },
            metrics: {
                visits: {
                    value: currentVisits,
                    trendValue: currentVisits - previousVisits,
                    trendPercent: trendPercent(currentVisits, previousVisits),
                },
                averageTimeSeconds: {
                    value: currentAverageTimeSeconds,
                    trendValue: currentAverageTimeSeconds - previousAverageTimeSeconds,
                    trendPercent: trendPercent(currentAverageTimeSeconds, previousAverageTimeSeconds),
                },
                registrations: {
                    value: currentRegistrations,
                    trendValue: currentRegistrations - previousRegistrations,
                    trendPercent: trendPercent(currentRegistrations, previousRegistrations),
                },
                revenueRub: {
                    value: currentRevenueRub,
                    trendValue: currentRevenueRub - previousRevenueRub,
                    trendPercent: trendPercent(currentRevenueRub, previousRevenueRub),
                },
            },
            points: Array.from(pointMap.values()).sort((left, right) => (
                new Date(left.time).getTime() - new Date(right.time).getTime()
            )),
        };
    }

    async getRecentTopUps(query: SiteAnalyticsRecentTopUpsQuery) {
        const limit = Math.min(Math.max(Number(query.limit ?? 6), 1), 20);
        const topUps = await this.topUpRepository
            .createQueryBuilder("topUp")
            .leftJoin(UserEntity, "user", "user.id = topUp.userId")
            .select("topUp.id", "id")
            .addSelect("topUp.userId", "userId")
            .addSelect("topUp.provider", "provider")
            .addSelect("topUp.status", "status")
            .addSelect("topUp.amountRub", "amountRub")
            .addSelect("topUp.creditedAmountRub", "creditedAmountRub")
            .addSelect("topUp.providerInvoiceId", "providerInvoiceId")
            .addSelect("topUp.createdAt", "createdAt")
            .addSelect("topUp.paidAt", "paidAt")
            .addSelect("user.username", "username")
            .addSelect("user.firstName", "firstName")
            .addSelect("user.lastName", "lastName")
            .orderBy("topUp.createdAt", "DESC")
            .limit(limit)
            .getRawMany<{
                id: string;
                userId: string;
                provider: string;
                status: EBalanceTopUpStatus;
                amountRub: string | number;
                creditedAmountRub: string | number;
                providerInvoiceId: string | null;
                createdAt: Date | string;
                paidAt: Date | string | null;
                username: string | null;
                firstName: string | null;
                lastName: string | null;
            }>();

        return {
            topUps: topUps.map((topUp) => {
                const displayName = [topUp.firstName, topUp.lastName].filter(Boolean).join(" ").trim()
                    || topUp.username
                    || `User ${topUp.userId.slice(0, 6)}`;

                return {
                    id: topUp.id,
                    userId: topUp.userId,
                    userName: displayName,
                    provider: topUp.provider,
                    status: topUp.status,
                    amountRub: metric(topUp.amountRub),
                    creditedAmountRub: metric(topUp.creditedAmountRub),
                    providerInvoiceId: topUp.providerInvoiceId,
                    createdAt: new Date(topUp.createdAt).toISOString(),
                    paidAt: topUp.paidAt ? new Date(topUp.paidAt).toISOString() : null,
                };
            }),
        };
    }
}
