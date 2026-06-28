import { createHash } from "crypto";
import { FastifyInstance } from "fastify";

const inFlightLoads = new Map<string, Promise<unknown>>();

function normalizeCacheValue(value: unknown): unknown {
    if (value instanceof Date) {
        return value.toISOString();
    }

    if (Array.isArray(value)) {
        return value.map(normalizeCacheValue);
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, item]) => [key, normalizeCacheValue(item)]),
        );
    }

    return value;
}

function buildCacheKey(namespace: string, version: string, params: unknown): string {
    const fingerprint = createHash("sha256")
        .update(JSON.stringify(normalizeCacheValue(params)))
        .digest("hex")
        .slice(0, 32);

    return `cache:data:${namespace}:${version}:${fingerprint}`;
}

function versionKey(namespace: string): string {
    return `cache:version:${namespace}`;
}

function reportCacheError(fastify: FastifyInstance, operation: string, error: unknown) {
    fastify.log.warn({ err: error, operation }, "Redis cache operation failed");
}

export async function getCachedJson<T>(
    fastify: FastifyInstance,
    namespace: string,
    params: unknown,
    ttlSeconds: number,
    loader: () => Promise<T>,
): Promise<T> {
    if (!fastify.redis.isReady) {
        return await loader();
    }

    let version: string;

    try {
        version = (await fastify.redis.get(versionKey(namespace))) ?? "0";
    } catch (error) {
        reportCacheError(fastify, "get-version", error);
        return await loader();
    }

    const key = buildCacheKey(namespace, version, params);

    try {
        const cached = await fastify.redis.get(key);

        if (cached !== null) {
            try {
                return JSON.parse(cached) as T;
            } catch (error) {
                reportCacheError(fastify, "parse", error);
                await fastify.redis.del(key).catch(() => undefined);
            }
        }
    } catch (error) {
        reportCacheError(fastify, "get", error);
        return await loader();
    }

    const currentLoad = inFlightLoads.get(key) as Promise<T> | undefined;

    if (currentLoad) {
        return await currentLoad;
    }

    const load = loader()
        .then(async (value) => {
            try {
                await fastify.redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
            } catch (error) {
                reportCacheError(fastify, "set", error);
            }

            return value;
        })
        .finally(() => {
            inFlightLoads.delete(key);
        });

    inFlightLoads.set(key, load);
    return await load;
}

export async function invalidateCacheNamespaces(
    fastify: FastifyInstance,
    namespaces: string[],
): Promise<void> {
    const uniqueNamespaces = Array.from(new Set(namespaces.filter(Boolean)));

    if (uniqueNamespaces.length === 0 || !fastify.redis.isReady) {
        return;
    }

    try {
        const transaction = fastify.redis.multi();

        for (const namespace of uniqueNamespaces) {
            transaction.incr(versionKey(namespace));
        }

        await transaction.exec();
    } catch (error) {
        reportCacheError(fastify, "invalidate", error);
    }
}
