import { FastifyInstance } from "fastify";

import {
    getSiteAnalyticsOverview,
    getSiteAnalyticsRecentTopUps,
    recordSiteAnalyticsHeartbeat,
    startSiteAnalyticsSession,
} from "./site-analytics.controller";
import {
    siteAnalyticsHeartbeatSchema,
    siteAnalyticsOverviewSchema,
    siteAnalyticsRecentTopUpsSchema,
    siteAnalyticsSessionSchema,
} from "./site-analytics.schema";

export async function siteAnalyticsRoutes(fastify: FastifyInstance) {
    fastify.post("/sessions", { schema: siteAnalyticsSessionSchema }, startSiteAnalyticsSession);
    fastify.post(
        "/sessions/:sessionId/heartbeat",
        { schema: siteAnalyticsHeartbeatSchema },
        recordSiteAnalyticsHeartbeat,
    );
    fastify.get("/overview", { schema: siteAnalyticsOverviewSchema }, getSiteAnalyticsOverview);
    fastify.get("/top-ups/recent", { schema: siteAnalyticsRecentTopUpsSchema }, getSiteAnalyticsRecentTopUps);
}
