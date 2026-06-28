import { createHash, timingSafeEqual } from "crypto";

import { EBalanceTopUpStatus, EPaymentProvider } from "../../../../database/entities/balance-top-up.entity";
import { AppError, UnauthorizedError } from "../../../../errors/appErrors";
import {
    CreatedPaymentInvoice,
    CreatePaymentInvoiceInput,
    NormalizedPaymentWebhook,
    PaymentProviderAdapter,
} from "../payment-adapter.types";

type TBankInitResponse = {
    Success?: boolean;
    ErrorCode?: string;
    Message?: string;
    Details?: string;
    PaymentId?: number | string;
    PaymentURL?: string;
    Status?: string;
};

type TBankTokenPayload = Record<string, unknown>;

function stringValue(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) {
        return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
    }

    return null;
}

function numberValue(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

function createTBankToken(payload: TBankTokenPayload, password: string): string {
    const values = Object.entries({ ...payload, Password: password })
        .filter(([key, value]) => (
            key !== "Token"
            && value !== null
            && value !== undefined
            && typeof value !== "object"
        ))
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([, value]) => String(value))
        .join("");

    return createHash("sha256").update(values, "utf8").digest("hex");
}

function tokensMatch(actual: string, expected: string): boolean {
    const actualBuffer = Buffer.from(actual, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");

    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function mapTBankStatus(value: string | null): EBalanceTopUpStatus {
    switch (value) {
        case "CONFIRMED":
            return EBalanceTopUpStatus.Paid;
        case "CANCELED":
        case "REJECTED":
        case "REVERSED":
        case "REFUNDED":
        case "PARTIAL_REVERSED":
        case "PARTIAL_REFUNDED":
        case "DEADLINE_EXPIRED":
            return EBalanceTopUpStatus.Canceled;
        default:
            return EBalanceTopUpStatus.Pending;
    }
}

export class TBankAdapter implements PaymentProviderAdapter {
    readonly provider = EPaymentProvider.TBank;

    private readonly apiUrl = (process.env.TBANK_API_URL ?? "https://securepay.tinkoff.ru/v2").replace(/\/+$/, "");
    private readonly terminalKey = process.env.TBANK_TERMINAL_KEY ?? "";
    private readonly password = process.env.TBANK_PASSWORD ?? "";
    private readonly notificationUrl = process.env.TBANK_NOTIFICATION_URL ?? "";
    private readonly successUrl = process.env.TBANK_SUCCESS_URL ?? "";
    private readonly failUrl = process.env.TBANK_FAIL_URL ?? "";

    async createInvoice(input: CreatePaymentInvoiceInput): Promise<CreatedPaymentInvoice> {
        if (!this.terminalKey || !this.password || !this.notificationUrl) {
            throw new AppError(
                "T‑Bank не настроен: нужны TBANK_TERMINAL_KEY, TBANK_PASSWORD и TBANK_NOTIFICATION_URL",
                500,
            );
        }

        const amountKopecks = input.amountRub * 100;
        const requestPayload: TBankTokenPayload = {
            TerminalKey: this.terminalKey,
            Amount: amountKopecks,
            OrderId: input.topUpId,
            Description: `Пополнение баланса на ${input.amountRub} ₽`,
            NotificationURL: this.notificationUrl,
            ...(this.successUrl ? { SuccessURL: this.successUrl } : {}),
            ...(this.failUrl ? { FailURL: this.failUrl } : {}),
            DATA: {
                Email: input.email,
            },
        };
        const body = {
            ...requestPayload,
            Token: createTBankToken(requestPayload, this.password),
        };

        const response = await fetch(`${this.apiUrl}/Init`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        const data = (await response.json().catch(() => null)) as TBankInitResponse | null;
        const paymentId = stringValue(data?.PaymentId);
        const paymentUrl = stringValue(data?.PaymentURL);

        if (!response.ok || data?.Success !== true || !paymentId || !paymentUrl) {
            const reason = data?.Details || data?.Message || `HTTP ${response.status}`;
            throw new AppError(`T‑Bank не создал платёж: ${reason}`, 502);
        }

        return {
            providerInvoiceId: paymentId,
            paymentUrl,
            expiresAt: null,
            raw: data as Record<string, unknown>,
        };
    }

    normalizeWebhook(payload: Record<string, unknown>): NormalizedPaymentWebhook {
        if (!this.terminalKey || !this.password) {
            throw new AppError("T‑Bank не настроен: нужны TBANK_TERMINAL_KEY и TBANK_PASSWORD", 500);
        }

        const payloadTerminalKey = stringValue(payload.TerminalKey);
        const actualToken = stringValue(payload.Token);

        if (payloadTerminalKey !== this.terminalKey || !actualToken) {
            throw new UnauthorizedError("Недействительное уведомление T‑Bank");
        }

        const expectedToken = createTBankToken(payload, this.password);

        if (!tokensMatch(actualToken, expectedToken)) {
            throw new UnauthorizedError("Недействительная подпись уведомления T‑Bank");
        }

        const providerInvoiceId = stringValue(payload.PaymentId);

        if (!providerInvoiceId) {
            throw new AppError("Уведомление T‑Bank не содержит PaymentId", 400);
        }

        const amountKopecks = numberValue(payload.Amount);

        return {
            provider: this.provider,
            orderId: stringValue(payload.OrderId),
            providerInvoiceId,
            status: mapTBankStatus(stringValue(payload.Status)),
            amountFiat: amountKopecks === null ? null : amountKopecks / 100,
            currency: "RUB",
            raw: payload,
        };
    }
}
