import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import { Client, PacketWriter, State } from "mcproto";

import { ServerEntity } from "../../../database/entities/server.entity";
import { getAnalyticsBucketAt } from "./analytics.service";
import { invalidateCacheNamespaces } from "../../../utils/cache";

const SCAN_INTERVAL_MS = 1000 * 60 * 30;
const SCAN_TIMEOUT_MS = 5000;
const SCAN_CHUNK_SIZE = 25;
const STATUS_PROTOCOL_VERSION = 404;
const SCAN_ATTEMPTS = 3;

interface MinecraftStatus {
    version?: {
        name?: string;
        protocol?: number;
    };
    players?: {
        online?: number;
        max?: number;
    };
    description?: unknown;
    [key: string]: unknown;
}

export interface ServerStatusScan {
    scannedAt: Date;
    isOnline: boolean;
    latencyMs: number | null;
    playersOnline: number | null;
    playersMax: number | null;
    versionName: string | null;
    protocolVersion: number | null;
    motd: string | null;
    statusJson: MinecraftStatus | null;
    scanError: string | null;
}

function normalizeError(error: unknown): string {
    if (error instanceof Error) {
        return error.message.slice(0, 1000);
    }

    return String(error).slice(0, 1000);
}

function normalizeMotd(description: unknown): string | null {
    if (typeof description === "string") {
        return description;
    }

    if (!description) {
        return null;
    }

    return JSON.stringify(description);
}

export class ServerScannerService {
    constructor(private readonly fastify: FastifyInstance) {}

    private get serverRepository() {
        return this.fastify.dataSource.getRepository(ServerEntity);
    }

    private async saveScan(
        serverId: string,
        bucketAt: Date,
        scan: ServerStatusScan,
    ) {
        await this.fastify.dataSource.query(
            `
                INSERT INTO "server_analytics" (
                    "id", "serverId", "bucketAt", "scannedAt", "isOnline",
                    "latencyMs", "playersOnline", "playersMax", "versionName",
                    "protocolVersion", "motd", "statusJson", "scanError", "updatedAt"
                )
                VALUES (
                    $1, $2, $3, $4, $5,
                    $6, $7, $8, $9,
                    $10, $11, $12, $13, CURRENT_TIMESTAMP
                )
                ON CONFLICT ("serverId", "bucketAt")
                DO UPDATE SET
                    "scannedAt" = EXCLUDED."scannedAt",
                    "isOnline" = EXCLUDED."isOnline",
                    "latencyMs" = EXCLUDED."latencyMs",
                    "playersOnline" = EXCLUDED."playersOnline",
                    "playersMax" = EXCLUDED."playersMax",
                    "versionName" = EXCLUDED."versionName",
                    "protocolVersion" = EXCLUDED."protocolVersion",
                    "motd" = EXCLUDED."motd",
                    "statusJson" = EXCLUDED."statusJson",
                    "scanError" = EXCLUDED."scanError",
                    "updatedAt" = CURRENT_TIMESTAMP
            `,
            [
                randomUUID(),
                serverId,
                bucketAt,
                scan.scannedAt,
                scan.isOnline,
                scan.latencyMs,
                scan.playersOnline,
                scan.playersMax,
                scan.versionName,
                scan.protocolVersion,
                scan.motd,
                scan.statusJson,
                scan.scanError,
            ],
        );
    }

    private async requestServerStatus(server: ServerEntity): Promise<ServerStatusScan> {
        const startedAt = Date.now();
        let client: Client | null = null;

        try {
            client = await Client.connect(server.ip, server.port === 25565 ? null : server.port, {
                connectTimeout: SCAN_TIMEOUT_MS,
                timeout: SCAN_TIMEOUT_MS,
            });
            client.on("error", () => undefined);

            await client.send(
                new PacketWriter(0x0)
                    .writeVarInt(STATUS_PROTOCOL_VERSION)
                    .writeString(server.ip)
                    .writeUInt16(server.port)
                    .writeVarInt(State.Status),
            );
            const responsePromise = client.nextPacket(0x0);
            await client.send(new PacketWriter(0x0));
            const response = await responsePromise;
            const status = response.readJSON() as MinecraftStatus;

            return {
                scannedAt: new Date(),
                isOnline: true,
                latencyMs: Date.now() - startedAt,
                playersOnline: status.players?.online ?? null,
                playersMax: status.players?.max ?? null,
                versionName: status.version?.name ?? null,
                protocolVersion: status.version?.protocol ?? null,
                motd: normalizeMotd(status.description),
                statusJson: status,
                scanError: null,
            };
        } finally {
            await client?.end().catch(() => undefined);
        }
    }

    private async scanServer(server: ServerEntity, bucketAt: Date): Promise<ServerStatusScan> {
        let lastError: unknown = null;

        for (let attempt = 1; attempt <= SCAN_ATTEMPTS; attempt += 1) {
            try {
                const scan = await this.requestServerStatus(server);
                await this.saveScan(server.id, bucketAt, scan);
                return scan;
            } catch (error) {
                lastError = error;
            }
        }

        const failedScan = {
            scannedAt: new Date(),
            isOnline: false,
            latencyMs: null,
            playersOnline: null,
            playersMax: null,
            versionName: null,
            protocolVersion: null,
            motd: null,
            statusJson: null,
            scanError: normalizeError(lastError),
        };

        await this.saveScan(server.id, bucketAt, failedScan);
        return failedScan;
    }

    async scanSingleServer(server: ServerEntity): Promise<ServerStatusScan> {
        const scan = await this.scanServer(server, getAnalyticsBucketAt());
        await invalidateCacheNamespaces(this.fastify, [
            "servers:list",
            "servers:search",
            "servers:detail",
            "servers:embeddings",
            "servers:user",
            `analytics:players:${server.id}`,
            `analytics:summary:${server.id}`,
        ]);

        return scan;
    }

    async scanAllServers() {
        const bucketAt = getAnalyticsBucketAt();
        const lockKey = `analytics:scanner:${bucketAt.toISOString()}`;
        const lock = await this.fastify.redis.set(lockKey, "1", {
            EX: Math.ceil(SCAN_INTERVAL_MS / 1000),
            NX: true,
        });

        if (lock !== "OK") {
            return;
        }

        const servers = await this.serverRepository.find();

        for (let index = 0; index < servers.length; index += SCAN_CHUNK_SIZE) {
            const chunk = servers.slice(index, index + SCAN_CHUNK_SIZE);
            await Promise.allSettled(chunk.map((server) => this.scanServer(server, bucketAt)));
        }

        await invalidateCacheNamespaces(this.fastify, [
            "servers:list",
            "servers:search",
            "servers:detail",
            "servers:embeddings",
            "servers:user",
            ...servers.flatMap((server) => [
                `analytics:players:${server.id}`,
                `analytics:summary:${server.id}`,
            ]),
        ]);

        console.log(`Проверка серверов завершена: ${servers.length}`);
    }
}

export const serverScanIntervalMs = SCAN_INTERVAL_MS;
