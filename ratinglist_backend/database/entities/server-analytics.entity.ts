import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";

import { ServerEntity } from "./server.entity";

@Entity("server_analytics")
@Index(["serverId", "bucketAt"], { unique: true })
export class ServerAnalyticsEntity {
    @PrimaryColumn()
    id!: string;

    @Column({ type: "varchar" })
    serverId!: string;

    @ManyToOne(() => ServerEntity, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "serverId" })
    server!: ServerEntity;

    @Column({ type: "timestamp" })
    bucketAt!: Date;

    @Column({ type: "timestamp", nullable: true })
    scannedAt!: Date | null;

    @Column({ type: "boolean", default: false })
    isOnline!: boolean;

    @Column({ type: "integer", nullable: true })
    latencyMs!: number | null;

    @Column({ type: "integer", nullable: true })
    playersOnline!: number | null;

    @Column({ type: "integer", nullable: true })
    playersMax!: number | null;

    @Column({ type: "varchar", nullable: true })
    versionName!: string | null;

    @Column({ type: "integer", nullable: true })
    protocolVersion!: number | null;

    @Column({ type: "text", nullable: true })
    motd!: string | null;

    @Column({ type: "jsonb", nullable: true })
    statusJson!: Record<string, unknown> | null;

    @Column({ type: "text", nullable: true })
    scanError!: string | null;

    @Column({ type: "integer", default: 0 })
    viewsCount!: number;

    @Column({ type: "integer", default: 0 })
    ipCopiesCount!: number;

    @Column({ type: "integer", default: 0 })
    votesCount!: number;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    updatedAt!: Date;
}
