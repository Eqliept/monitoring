import { EBalanceTopUpStatus, EPaymentProvider } from "../../database/entities/balance-top-up.entity";

export type CreateTopUpBody = {
    amountRub: number;
    method: EPaymentProvider;
};

export type PurchaseRatingBody = {
    serverId: string;
    amount: number;
};

export type SerializedBalanceTopUp = {
    id: string;
    provider: EPaymentProvider;
    status: EBalanceTopUpStatus;
    amountRub: number;
    creditedAmountRub: number;
    paymentUrl: string | null;
    providerInvoiceId: string | null;
    createdAt: Date;
    paidAt: Date | null;
    expiresAt: Date | null;
};
