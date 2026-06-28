import { Entity, PrimaryColumn, Column } from "typeorm";

export enum EAccountProvider {
    Email = "Email",
    Google = "google",
    Discord = "discord"
}

@Entity("accounts")
export class AccountEntity {
    @PrimaryColumn()
    id!: string;

    @Column({
        type: "enum",
        enum: EAccountProvider,
    })
    provider!: EAccountProvider;

    @Column()
    email!: string;

    @Column({ type: "varchar" })
    userId!: string;

    @Column({ default: false })
    twoFactorEnabled!: boolean;

    @Column({ type: "text", nullable: true })
    secondFactorPasswordHash!: string | null;

    @Column({ type: "text", nullable: true })
    twoFactorSecret!: string | null;

    @Column({ type: "timestamp", nullable: true })
    twoFactorEnabledAt!: Date | null;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    createdAt!: Date;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    updatedAt!: Date;
}
