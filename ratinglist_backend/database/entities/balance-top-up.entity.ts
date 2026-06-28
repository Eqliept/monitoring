import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export enum EPaymentProvider {
    TBank = "tbank",
    
    CryptoCloud = "cryptocloud",
}

export enum EBalanceTopUpStatus {
    Pending = "pending",
    Paid = "paid",
    Partial = "partial",
    Overpaid = "overpaid",
    Canceled = "canceled",
    Failed = "failed",
}

@Entity("balance_top_ups")
@Index(["provider", "providerInvoiceId"], { unique: true, where: "\"providerInvoiceId\" IS NOT NULL" })
export class BalanceTopUpEntity {
    @PrimaryColumn()
    id!: string;

    @Column({ type: "varchar" })
    userId!: string;

    @Column({
        type: "enum",
        enum: EPaymentProvider,
    })
    provider!: EPaymentProvider;

    @Column({
        type: "enum",
        enum: EBalanceTopUpStatus,
        default: EBalanceTopUpStatus.Pending,
    })
    status!: EBalanceTopUpStatus;

    @Column({ type: "integer" })
    amountRub!: number;

    @Column({ type: "integer", default: 0 })
    creditedAmountRub!: number;

    @Column({ type: "varchar", nullable: true })
    providerInvoiceId!: string | null;

    @Column({ type: "varchar", nullable: true })
    paymentUrl!: string | null;

    @Column({ type: "jsonb", nullable: true })
    providerPayload!: Record<string, unknown> | null;

    @Column({ type: "timestamp", nullable: true })
    paidAt!: Date | null;

    @Column({ type: "timestamp", nullable: true })
    expiresAt!: Date | null;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    createdAt!: Date;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    updatedAt!: Date;
}
