import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

import { SiteAnalyticsService } from "../modules/site-analytics/site-analytics.service/site-analytics.service";

const SITE_ANALYTICS_FLUSH_INTERVAL_MS = 15_000;

async function siteAnalyticsFlusher(fastify: FastifyInstance) {
    let isFlushing = false;

    const flush = async () => {
        if (isFlushing || !fastify.redis.isReady) {
            return;
        }

        isFlushing = true;

        try {
            const result = await new SiteAnalyticsService(fastify).flushDueSessions();

            if (result.persisted > 0) {
                fastify.log.debug({ result }, "Site analytics sessions flushed");
            }
        } catch (error) {
            fastify.log.warn({ err: error }, "Site analytics flush failed");
        } finally {
            isFlushing = false;
        }
    };

    const interval = setInterval(() => {
        void flush();
    }, SITE_ANALYTICS_FLUSH_INTERVAL_MS);

    interval.unref();

    fastify.addHook("onReady", async () => {
        await flush();
    });

    fastify.addHook("onClose", async () => {
        clearInterval(interval);
    });
}

export default fp(siteAnalyticsFlusher);
