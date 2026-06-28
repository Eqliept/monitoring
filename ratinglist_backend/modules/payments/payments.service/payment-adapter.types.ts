import { EBalanceTopUpStatus, EPaymentProvider } from "../../../database/entities/balance-top-up.entity";

export type CreatePaymentInvoiceInput = {
    topUpId: string;
    amountRub: number;
    email: string;
};

export type CreatedPaymentInvoice = {
    providerInvoiceId: string;
    paymentUrl: string;
    expiresAt: Date | null;
    raw: Record<string, unknown>;
};

export type NormalizedPaymentWebhook = {
    provider: EPaymentProvider;
    orderId: string | null;
    providerInvoiceId: string;
    status: EBalanceTopUpStatus;
    amountFiat: number | null;
    currency: string | null;
    raw: Record<string, unknown>;
};

export interface PaymentProviderAdapter {
    readonly provider: EPaymentProvider;
    createInvoice(input: CreatePaymentInvoiceInput): Promise<CreatedPaymentInvoice>;
    normalizeWebhook(payload: Record<string, unknown>): NormalizedPaymentWebhook;
}
