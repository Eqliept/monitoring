import { FastifyInstance } from "fastify";

import { AppError } from "../../../errors/appErrors";
import { getCachedJson } from "../../../utils/cache";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const EMBEDDING_BATCH_SIZE = 64;

interface ServerContextSnapshot {
    serverId: string;
    name: string;
    slogan: string | null;
    description: string | null;
    categories: Record<string, unknown> | null;
    versions: string[] | null;
    versionName: string | null;
    playersOnline: number | null;
    playersMax: number | null;
    motd: string | null;
}

interface StoredServerContext {
    serverId: string;
    context: string;
    model: string;
}

interface OpenAiEmbeddingsResponse {
    data?: Array<{
        embedding?: number[];
        index?: number;
    }>;
    error?: {
        message?: string;
    };
}

function formatCategories(categories: Record<string, unknown> | null): string {
    if (!categories) {
        return "не указаны";
    }

    const values = Object.entries(categories)
        .filter(([, value]) => Boolean(value))
        .map(([key, value]) => {
            if (value === true) {
                return key;
            }

            if (Array.isArray(value)) {
                return `${key}: ${value.join(", ")}`;
            }

            return `${key}: ${String(value)}`;
        });

    return values.length > 0 ? values.join(", ") : "не указаны";
}

function formatVersions(versions: string[] | null): string {
    return versions && versions.length > 0 ? versions.join(", ") : "не указаны";
}

function formatPlayers(online: number | null, max: number | null): string {
    if (online === null && max === null) {
        return "Данные об игроках временно недоступны.";
    }

    return `Сейчас играет ${online ?? 0} из ${max ?? "неизвестного количества"} игроков.`;
}

function buildServerContext(snapshot: ServerContextSnapshot): string {
    return [
        `Сервер ${snapshot.name}.`,
        snapshot.slogan ? `${snapshot.slogan}.` : "",
        `Описание: ${snapshot.description ?? "не указано"}.`,
        `Основные категории: ${formatCategories(snapshot.categories)}.`,
        `Версии: ${formatVersions(snapshot.versions)}.`,
        `Версия протокола: ${snapshot.versionName ?? "не указана"}.`,
        formatPlayers(snapshot.playersOnline, snapshot.playersMax),
        `Текст MOTD: ${snapshot.motd ?? "не указан"}.`,
    ]
        .filter(Boolean)
        .join(" ");
}

function vectorToSql(vector: number[]): string {
    if (vector.length !== EMBEDDING_DIMENSIONS || vector.some((value) => !Number.isFinite(value))) {
        throw new AppError("OpenAI вернул некорректный embedding", 502);
    }

    return `[${vector.join(",")}]`;
}

export class ServerSemanticSearchService {
    constructor(private readonly fastify: FastifyInstance) {}

    private async loadSnapshots(): Promise<Array<ServerContextSnapshot & { context: string }>> {
        const rows = await this.fastify.dataSource.query<ServerContextSnapshot[]>(`
            SELECT
                server."id" AS "serverId",
                server."name",
                server."slogan",
                server."description",
                server."categories",
                server."versions",
                latest."versionName",
                latest."playersOnline",
                latest."playersMax",
                latest."motd"
            FROM "servers" server
            LEFT JOIN LATERAL (
                SELECT
                    analytics."versionName",
                    analytics."playersOnline",
                    analytics."playersMax",
                    analytics."motd"
                FROM "server_analytics" analytics
                WHERE analytics."serverId" = server."id"
                    AND analytics."scannedAt" IS NOT NULL
                ORDER BY analytics."bucketAt" DESC
                LIMIT 1
            ) latest ON TRUE
            WHERE server."isMotdVerified" = TRUE
                AND server."moderationStatus" = 'approved'
        `);

        return rows.map((row) => ({
            ...row,
            context: buildServerContext(row),
        }));
    }

    private async requestEmbeddings(inputs: string[]): Promise<number[][]> {
        const apiKey = process.env.OPENAI_API_KEY?.trim();

        if (!apiKey) {
            throw new AppError("AI-поиск временно недоступен: OPENAI_API_KEY не настроен", 503);
        }

        const response = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                input: inputs,
                model: EMBEDDING_MODEL,
                encoding_format: "float",
            }),
        });
        const payload = (await response.json().catch(() => ({}))) as OpenAiEmbeddingsResponse;

        if (!response.ok) {
            throw new AppError(payload.error?.message ?? "Не удалось получить embeddings от OpenAI", 502);
        }

        const embeddings = [...(payload.data ?? [])]
            .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
            .map((item) => item.embedding ?? []);

        if (embeddings.length !== inputs.length) {
            throw new AppError("OpenAI вернул неполный набор embeddings", 502);
        }

        embeddings.forEach(vectorToSql);
        return embeddings;
    }

    private async refreshStaleEmbeddings(): Promise<void> {
        const snapshots = await this.loadSnapshots();
        const storedRows = await this.fastify.dataSource.query<StoredServerContext[]>(`
            SELECT "serverId", "context", "model"
            FROM "server_search_embeddings"
        `);
        const storedByServerId = new Map(storedRows.map((row) => [row.serverId, row]));
        const staleSnapshots = snapshots.filter((snapshot) => {
            const stored = storedByServerId.get(snapshot.serverId);
            return !stored || stored.context !== snapshot.context || stored.model !== EMBEDDING_MODEL;
        });

        for (let index = 0; index < staleSnapshots.length; index += EMBEDDING_BATCH_SIZE) {
            const batch = staleSnapshots.slice(index, index + EMBEDDING_BATCH_SIZE);
            const embeddings = await this.requestEmbeddings(batch.map((snapshot) => snapshot.context));

            for (let batchIndex = 0; batchIndex < batch.length; batchIndex += 1) {
                const snapshot = batch[batchIndex];
                const embedding = embeddings[batchIndex];

                await this.fastify.dataSource.query(
                    `
                        INSERT INTO "server_search_embeddings" (
                            "serverId", "context", "embedding", "model", "updatedAt"
                        )
                        VALUES ($1, $2, $3::vector, $4, CURRENT_TIMESTAMP)
                        ON CONFLICT ("serverId")
                        DO UPDATE SET
                            "context" = EXCLUDED."context",
                            "embedding" = EXCLUDED."embedding",
                            "model" = EXCLUDED."model",
                            "updatedAt" = CURRENT_TIMESTAMP
                    `,
                    [snapshot.serverId, snapshot.context, vectorToSql(embedding), EMBEDDING_MODEL],
                );
            }
        }
    }

    async findServerIds(query: string, limit: number): Promise<string[]> {
        await getCachedJson(this.fastify, "servers:embeddings", {}, 300, async () => {
            await this.refreshStaleEmbeddings();
            return true;
        });
        const [queryEmbedding] = await this.requestEmbeddings([query]);
        const rows = await this.fastify.dataSource.query<Array<{ serverId: string }>>(
            `
                SELECT embedding."serverId"
                FROM "server_search_embeddings" embedding
                INNER JOIN "servers" server ON server."id" = embedding."serverId"
                WHERE server."isMotdVerified" = TRUE
                    AND server."moderationStatus" = 'approved'
                ORDER BY embedding."embedding" <=> $1::vector
                LIMIT $2
            `,
            [vectorToSql(queryEmbedding), limit],
        );

        return rows.map((row) => row.serverId);
    }
}
