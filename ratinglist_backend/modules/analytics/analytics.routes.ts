import { FastifyInstance } from "fastify";

import {
    getAnalyticsSummary,
    getPlayersAnalytics,
    recordIpCopy,
    recordServerView,
} from "./analytics.controller";
import {
    analyticsPlayersQuerySchema,
    analyticsServerParamsSchema,
    analyticsViewSchema,
} from "./analytics.schema";

export async function analyticsRoutes(fastify: FastifyInstance) {
    fastify.get(
        "/servers/:serverId/players",
        { schema: { ...analyticsServerParamsSchema, ...analyticsPlayersQuerySchema } },
        getPlayersAnalytics,
    );
    fastify.get("/servers/:serverId/summary", { schema: analyticsServerParamsSchema }, getAnalyticsSummary);
    fastify.post(
        "/servers/:serverId/events/view",
        { schema: { ...analyticsServerParamsSchema, ...analyticsViewSchema } },
        recordServerView,
    );
    fastify.post("/servers/:serverId/events/ip-copy", { schema: analyticsServerParamsSchema }, recordIpCopy);
}
