import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;
const MAX_RECONNECT_ATTEMPTS = 10;

declare module "fastify" {
    interface FastifyInstance {
        redis: RedisClient;
    }
}

async function redisClient(fastify: FastifyInstance) {
    const client = createClient({
        url: process.env.REDIS_URL,
        disableOfflineQueue: true,
        socket: {
            reconnectStrategy: (retries: number) => {
                if (retries >= MAX_RECONNECT_ATTEMPTS) {
                    return new Error(`Redis reconnect limit reached (${MAX_RECONNECT_ATTEMPTS})`);
                }

                return Math.min(100 * 2 ** retries, 3000) + Math.floor(Math.random() * 100);
            },
        },
    });

    client.on("ready", () => {
        fastify.log.info("Redis connected");
    });

    client.on("reconnecting", () => {
        fastify.log.warn("Redis reconnecting");
    });

    client.on("error", (error) => {
        fastify.log.error({ err: error }, "Redis error");
    });

    await client.connect();
    fastify.decorate("redis", client);

    fastify.addHook("onClose", async () => {
        if (client.isOpen) {
            await client.quit();
        }
    });
}

export default fp(redisClient);
