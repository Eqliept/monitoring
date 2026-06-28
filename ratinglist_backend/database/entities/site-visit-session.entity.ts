import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity("site_visit_sessions")
@Index(["startedAt"])
@Index(["lastSeenAt"])
@Index(["visitorHash"])
export class SiteVisitSessionEntity {
    @PrimaryColumn()
    id!: string;

    @Column({ type: "varchar" })
    visitorHash!: string;

    @Column({ type: "varchar", nullable: true })
    accountId!: string | null;

    @Column({ type: "varchar", nullable: true })
    userId!: string | null;

    @Column({ type: "timestamp" })
    startedAt!: Date;

    @Column({ type: "timestamp" })
    lastSeenAt!: Date;

    @Column({ type: "integer", default: 0 })
    durationSeconds!: number;

    @Column({ type: "integer", default: 1 })
    pageViewsCount!: number;

    @Column({ type: "varchar", nullable: true })
    entryPath!: string | null;

    @Column({ type: "varchar", nullable: true })
    lastPath!: string | null;

    @Column({ type: "text", nullable: true })
    referrer!: string | null;

    @Column({ type: "varchar", nullable: true })
    userAgentHash!: string | null;

    @Column({ type: "varchar", nullable: true })
    ipHash!: string | null;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    createdAt!: Date;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    updatedAt!: Date;
}
