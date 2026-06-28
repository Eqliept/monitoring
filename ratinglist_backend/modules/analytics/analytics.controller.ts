import { FastifyReply, FastifyRequest } from "fastify";

import { AnalyticsService } from "./analytics.service/analytics.service";
import { AnalyticsPlayersQuery, AnalyticsServerParams, AnalyticsViewPayload } from "./analytics.types";

function getAnalyticsService(request: FastifyRequest) {
    return new AnalyticsService(request.server);
}

export async function getPlayersAnalytics(
    request: FastifyRequest<{ Params: AnalyticsServerParams; Querystring: AnalyticsPlayersQuery }>,
    reply: FastifyReply,
) {
    const service = getAnalyticsService(request);
    return reply.send(await service.getPlayersAnalytics(request.params.serverId, request.query.period ?? "day"));
}

export async function getAnalyticsSummary(
    request: FastifyRequest<{ Params: AnalyticsServerParams }>,
    reply: FastifyReply,
) {
    const service = getAnalyticsService(request);
    const token = request.cookies["access_token"];
    return reply.send(await service.getDashboardSummary(request.params.serverId, token));
}

export async function recordServerView(
    request: FastifyRequest<{ Params: AnalyticsServerParams; Body: AnalyticsViewPayload }>,
    reply: FastifyReply,
) {
    const service = getAnalyticsService(request);
    const visitorId = request.body?.visitorId?.trim() || request.ip;
    return reply.send(await service.recordView(request.params.serverId, visitorId));
}

export async function recordIpCopy(
    request: FastifyRequest<{ Params: AnalyticsServerParams }>,
    reply: FastifyReply,
) {
    const service = getAnalyticsService(request);
    return reply.send(await service.recordIpCopy(request.params.serverId));
}
