import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";

import { UserEntity } from "./users.entity";

export interface ServerManagerEntityValue {
    id: string;
    userId?: string;
    name?: string;
    email: string;
    createdAt: string;
}

export enum EServerModerationStatus {
    MotdPending = "motd_pending",
    ReviewPending = "review_pending",
    Approved = "approved",
    Rejected = "rejected",
}

@Entity("servers")
@Index(["slug"], { unique: true })
@Index(["ip"], { unique: true })
@Index(["ownerUserId"])
@Index(["rating"])
@Index(["moderationStatus"])
export class ServerEntity {
    @PrimaryColumn()
    id!: string;

    @Column({ type: "varchar", unique: true })
    slug!: string;

    @Column({ type: "varchar" })
    ownerUserId!: string;

    @ManyToOne(() => UserEntity, (user) => user.servers, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "ownerUserId" })
    owner!: UserEntity;

    @Column({ type: "varchar" })
    name!: string;

    @Column({ type: "varchar" })
    ip!: string;

    @Column({ type: "integer", default: 25565 })
    port!: number;

    @Column({ type: "varchar", nullable: true })
    slogan!: string | null;

    @Column({ type: "text", nullable: true })
    description!: string | null;

    @Column({ type: "varchar", nullable: true })
    website!: string | null;

    @Column({ type: "varchar", nullable: true })
    youtube!: string | null;

    @Column({ type: "varchar", nullable: true })
    discord!: string | null;

    @Column({ type: "varchar", nullable: true })
    telegram!: string | null;

    @Column({ type: "varchar", nullable: true })
    vk!: string | null;

    @Column({ type: "varchar", nullable: true })
    bannerUrl!: string | null;

    @Column({ type: "varchar", nullable: true })
    logoUrl!: string | null;

    @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
    categories!: Record<string, unknown>;

    @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
    imageUrls!: string[];

    @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
    versions!: string[];

    @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
    managers!: ServerManagerEntityValue[];

    @Column({ type: "integer", default: 0 })
    rating!: number;

    @Column({ type: "boolean", default: false })
    isMotdVerified!: boolean;

    @Column({ type: "varchar", nullable: true })
    motdVerificationCode!: string | null;

    @Column({ type: "timestamp", nullable: true })
    motdVerifiedAt!: Date | null;

    @Column({ type: "varchar", nullable: true })
    motdClaimUserId!: string | null;

    @Column({ type: "timestamp", nullable: true })
    motdClaimedAt!: Date | null;

    @Column({
        type: "enum",
        enum: EServerModerationStatus,
        default: EServerModerationStatus.MotdPending,
    })
    moderationStatus!: EServerModerationStatus;

    @Column({ type: "text", nullable: true })
    moderationComment!: string | null;

    @Column({ type: "varchar", nullable: true })
    reviewedByAccountId!: string | null;

    @Column({ type: "timestamp", nullable: true })
    reviewedAt!: Date | null;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    createdAt!: Date;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    updatedAt!: Date;
}
