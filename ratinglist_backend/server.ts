import "reflect-metadata";
import "dotenv/config";
import Fastify from "fastify";
import { authRoutes } from "./modules/auth/auth.routes";
import errorHandlerPlugin from "./plugins/error";
import corsPlugin from "./plugins/cors";
import localePlugin from "./plugins/locale";
import redis from "./plugins/redis";
import typeorm from "./plugins/typeorm";
import siteAnalyticsFlusher from "./plugins/site-analytics-flusher";
import cloudinary from "./plugins/cloudinary";
import cookie from '@fastify/cookie';
import { profileRoutes } from "./modules/profile/profile.routes";
import { securityRoutes } from "./modules/security/security.routes";
import { serversRoutes } from "./modules/servers/servers.routes";
import { serverTaxonomyRoutes } from "./modules/server-taxonomy/server-taxonomy.routes";
import { mediaRoutes } from "./modules/media/media.routes";
import { messagesRoutes } from "./modules/messages/messages.routes";
import { votesRoutes } from "./modules/votes/votes.routes";
import { analyticsRoutes } from "./modules/analytics/analytics.routes";
import { paymentsRoutes } from "./modules/payments/payments.routes";
import { siteAnalyticsRoutes } from "./modules/site-analytics/site-analytics.routes";
import { blogsRoutes } from "./modules/blogs/blogs.routes";
import serverScanner from "./plugins/server-scanner";

const app = Fastify({
    logger: true,
});

app.register(errorHandlerPlugin)
app.register(corsPlugin)
app.register(localePlugin)
app.register(redis)
app.register(typeorm)
app.register(siteAnalyticsFlusher)
app.register(cloudinary)
app.register(serverScanner)

app.register(cookie, {
        secret: process.env.COOKIE_SECRET,
})

app.register(authRoutes, { prefix: "/api/auth" })
app.register(profileRoutes, { prefix: "/api/profile" })
app.register(securityRoutes, { prefix: "/api/security" })
app.register(serversRoutes, { prefix: "/api/servers" })
app.register(serverTaxonomyRoutes, { prefix: "/api/server-taxonomy" })
app.register(mediaRoutes, { prefix: "/api/media" })
app.register(messagesRoutes, { prefix: "/api/messages" })
app.register(votesRoutes, { prefix: "/api/votes" })
app.register(analyticsRoutes, { prefix: "/api/analytics" })
app.register(siteAnalyticsRoutes, { prefix: "/api/site-analytics" })
app.register(paymentsRoutes, { prefix: "/api/payments" })
app.register(blogsRoutes, { prefix: "/api/blogs" })

app.get("/", async (request, reply) => {
    return { "message": "Hello World" }
})

app.get("/health", async () => {
    return { status: "ok" };
})

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";

const shutdown = async (signal: NodeJS.Signals) => {
    app.log.info({ signal }, "Stopping server");

    try {
        await app.close();
        process.exit(0);
    } catch (error) {
        app.log.error(error, "Failed to stop server gracefully");
        process.exit(1);
    }
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

const start = async () => {
    try {
        await app.listen({ port, host });
    } catch (error) {
        app.log.error(error, "Failed to start server");
        process.exit(1);
    }
};

void start();
