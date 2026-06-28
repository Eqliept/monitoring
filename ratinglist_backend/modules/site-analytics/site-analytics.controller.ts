import { FastifyReply, FastifyRequest } from "fastify";

import { SiteAnalyticsService } from "./site-analytics.service/site-analytics.service";
import {
    SiteAnalyticsHeartbeatBody,
    SiteAnalyticsHeartbeatParams,
    SiteAnalyticsOverviewQuery,
    SiteAnalyticsRecentTopUpsQuery,
    SiteAnalyticsSessionBody,
} from "./site-analytics.types";

function getSiteAnalyticsService(request: FastifyRequest) {
    return new SiteAnalyticsService(request.server);
}

function getHeaderValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

export async function startSiteAnalyticsSession(
    request: FastifyRequest<{ Body: SiteAnalyticsSessionBody }>,
    reply: FastifyReply,
) {
    return reply.status(201).send(await getSiteAnalyticsService(request).startSession(request.body, {
        accessToken: request.cookies["access_token"],
        ip: request.ip,
        userAgent: getHeaderValue(request.headers["user-agent"]),
    }));
}

export async function recordSiteAnalyticsHeartbeat(
    request: FastifyRequest<{ Params: SiteAnalyticsHeartbeatParams; Body: SiteAnalyticsHeartbeatBody }>,
    reply: FastifyReply,
) {
    return reply.send(await getSiteAnalyticsService(request).recordHeartbeat(request.params.sessionId, request.body));
}

export async function getSiteAnalyticsOverview(
    request: FastifyRequest<{ Querystring: SiteAnalyticsOverviewQuery }>,
    reply: FastifyReply,
) {
    return reply.send(await getSiteAnalyticsService(request).getOverview(request.query));
}

export async function getSiteAnalyticsRecentTopUps(
    request: FastifyRequest<{ Querystring: SiteAnalyticsRecentTopUpsQuery }>,
    reply: FastifyReply,
) {
    return reply.send(await getSiteAnalyticsService(request).getRecentTopUps(request.query));
}
