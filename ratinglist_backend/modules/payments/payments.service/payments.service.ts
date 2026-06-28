import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import jwt, { JwtPayload } from "jsonwebtoken";
import { DataSource, EntityManager } from "typeorm";

import { AccountEntity } from "../../../database/entities/account.entity";
import {
    BalanceTopUpEntity,
    EBalanceTopUpStatus,
    EPaymentProvider,
} from "../../../database/entities/balance-top-up.entity";
import { ServerEntity, ServerManagerEntityValue } from "../../../database/entities/server.entity";
import { UserEntity } from "../../../database/entities/users.entity";
import { AppError, NotFoundError, UnauthorizedError } from "../../../errors/appErrors";
import { TSecret } from "../../auth/auth.service/auth.types";
import { CreateTopUpBody, PurchaseRatingBody, SerializedBalanceTopUp } from "../payments.types";
import { TBankAdapter } from "./adapters/tbank.adapter";
import { NormalizedPaymentWebhook, PaymentProviderAdapter } from "./payment-adapter.types";
import { getCachedJson, invalidateCacheNamespaces } from "../../../utils/cache";

const accessSecret: TSecret = (process.env.JWT_SECRET ?? "") as TSecret;
const MIN_TOP_UP_AMOUNT_RUB = 100;
const RATING_PRICE_RUB = 100;

if (!accessSecret) {
    throw new Error("Критическая ошибка: JWT секрет не задан в .env");
}

export class PaymentsService {
    private readonly adapters: Map<EPaymentProvider, PaymentProviderAdapter>;

    constructor(private readonly fastify: FastifyInstance) {
        this.adapters = new Map([[EPaymentProvider.TBank, new TBankAdapter()]]);
    }

    private get dataSource(): DataSource {
        return this.fastify.dataSource;
    }

    private getAccountRepository(manager?: EntityManager) {
        return (manager ?? this.dataSource.manager).getRepository(AccountEntity);
    }

    private getUserRepository(manager?: EntityManager) {
        return (manager ?? this.dataSource.manager).getRepository(UserEntity);
    }

    private getServerRepository(manager?: EntityManager) {
        return (manager ?? this.dataSource.manager).getRepository(ServerEntity);
    }

    private getTopUpRepository(manager?: EntityManager) {
        return (manager ?? this.dataSource.manager).getRepository(BalanceTopUpEntity);
    }

    private getAdapter(provider: EPaymentProvider): PaymentProviderAdapter {
        const adapter = this.adapters.get(provider);

        if (!adapter) {
            throw new AppError("Метод оплаты временно недоступен", 400);
        }

        return adapter;
    }

    private async verifyAccessToken(token: string): Promise<JwtPayload> {
        try {
            return jwt.verify(token, accessSecret) as JwtPayload;
        } catch {
            throw new UnauthorizedError("Неверный или просроченный access token");
        }
    }

    private async getAccountFromAccessToken(token?: string): Promise<AccountEntity> {
        if (!token) {
            throw new UnauthorizedError("Access token не предоставлен");
        }

        const decoded = await this.verifyAccessToken(token);
        const subject = decoded.sub as string | undefined;

        if (!subject) {
            throw new UnauthorizedError("Неверный access token (нет sub)");
        }

        const account = await this.getAccountRepository().findOne({ where: { id: subject } });

        if (!account) {
            throw new UnauthorizedError("Аккаунт не найден");
        }

        return account;
    }

    private serializeTopUp(topUp: BalanceTopUpEntity): SerializedBalanceTopUp {
        return {
            id: topUp.id,
            provider: topUp.provider,
            status: topUp.status,
            amountRub: topUp.amountRub,
            creditedAmountRub: topUp.creditedAmountRub,
            paymentUrl: topUp.paymentUrl,
            providerInvoiceId: topUp.providerInvoiceId,
            createdAt: topUp.createdAt,
            paidAt: topUp.paidAt,
            expiresAt: topUp.expiresAt,
        };
    }

    private normalizeManagers(value: unknown): ServerManagerEntityValue[] {
        if (!Array.isArray(value)) {
            return [];
        }

        return value
            .filter((item): item is ServerManagerEntityValue => Boolean(item) && typeof item === "object")
            .map((item) => ({
                id: String(item.id),
                userId: item.userId ? String(item.userId) : undefined,
                name: item.name ? String(item.name) : undefined,
                email: String(item.email),
                createdAt: String(item.createdAt),
            }))
            .filter((item) => item.id && item.email && item.createdAt);
    }

    private canManageServer(server: ServerEntity, userId: string): boolean {
        return server.ownerUserId === userId || this.normalizeManagers(server.managers).some((manager) => manager.userId === userId);
    }

    getMethods() {
        return {
            methods: [
                {
                    id: EPaymentProvider.TBank,
                    title: "T‑Bank",
                    description: "Оплата банковской картой через T‑Bank",
                    minAmountRub: MIN_TOP_UP_AMOUNT_RUB,
                },
            ],
        };
    }

    async getBalance(token?: string) {
        const account = await this.getAccountFromAccessToken(token);
        return await getCachedJson(this.fastify, `payments:balance:${account.userId}`, {}, 30, async () => {
            const user = await this.getUserRepository().findOne({ where: { id: account.userId } });

            if (!user) {
                throw new UnauthorizedError("Связанный пользователь не найден");
            }

            return { balanceRub: user.balanceRub };
        });
    }

    async listTopUps(token?: string) {
        const account = await this.getAccountFromAccessToken(token);
        return await getCachedJson(this.fastify, `payments:topups:${account.userId}`, {}, 30, async () => {
            const topUps = await this.getTopUpRepository().find({
                where: { userId: account.userId },
                order: { createdAt: "DESC" },
                take: 50,
            });

            return { topUps: topUps.map((topUp) => this.serializeTopUp(topUp)) };
        });
    }

    async createTopUp(token: string | undefined, payload: CreateTopUpBody) {
        const amountRub = Number(payload.amountRub);

        if (!Number.isInteger(amountRub) || amountRub < MIN_TOP_UP_AMOUNT_RUB) {
            throw new AppError(`Минимальная сумма пополнения ${MIN_TOP_UP_AMOUNT_RUB} рублей`, 400);
        }

        const account = await this.getAccountFromAccessToken(token);
        const user = await this.getUserRepository().findOne({ where: { id: account.userId } });

        if (!user) {
            throw new UnauthorizedError("Связанный пользователь не найден");
        }

        const adapter = this.getAdapter(payload.method);
        const repo = this.getTopUpRepository();
        let topUp = repo.create({
            id: randomUUID(),
            userId: user.id,
            provider: adapter.provider,
            status: EBalanceTopUpStatus.Pending,
            amountRub,
            creditedAmountRub: 0,
            providerInvoiceId: null,
            paymentUrl: null,
            providerPayload: null,
            paidAt: null,
            expiresAt: null,
        });

        topUp = await repo.save(topUp);

        try {
            const invoice = await adapter.createInvoice({
                topUpId: topUp.id,
                amountRub,
                email: account.email,
            });

            topUp.providerInvoiceId = invoice.providerInvoiceId;
            topUp.paymentUrl = invoice.paymentUrl;
            topUp.providerPayload = invoice.raw;
            topUp.expiresAt = invoice.expiresAt;
            topUp.updatedAt = new Date();
            topUp = await repo.save(topUp);
        } catch (error) {
            topUp.status = EBalanceTopUpStatus.Failed;
            topUp.providerPayload = {
                error: error instanceof Error ? error.message : "Не удалось создать счет",
            };
            topUp.updatedAt = new Date();
            await repo.save(topUp);
            await invalidateCacheNamespaces(this.fastify, [`payments:topups:${user.id}`]);
            throw error;
        }

        await invalidateCacheNamespaces(this.fastify, [`payments:topups:${user.id}`]);
        return { topUp: this.serializeTopUp(topUp) };
    }

    async purchaseRating(token: string | undefined, payload: PurchaseRatingBody) {
        const amount = Number(payload.amount);

        if (!Number.isInteger(amount) || amount < 1 || amount > 1000) {
            throw new AppError("Укажите количество рейтинга от 1 до 1000", 400);
        }

        const account = await this.getAccountFromAccessToken(token);
        const costRub = amount * RATING_PRICE_RUB;

        const result = await this.dataSource.transaction(async (manager) => {
            const user = await this.getUserRepository(manager).findOne({
                where: { id: account.userId },
                lock: { mode: "pessimistic_write" },
            });

            if (!user) {
                throw new UnauthorizedError("Связанный пользователь не найден");
            }

            const server = await this.getServerRepository(manager).findOne({
                where: { id: payload.serverId },
                lock: { mode: "pessimistic_write" },
            });

            if (!server) {
                throw new NotFoundError("Сервер не найден");
            }

            if (!this.canManageServer(server, user.id)) {
                throw new UnauthorizedError("Нет доступа к продвижению этого сервера");
            }

            if (user.balanceRub < costRub) {
                throw new AppError("Недостаточно средств на балансе", 400);
            }

            user.balanceRub -= costRub;
            user.updatedAt = new Date();
            server.rating += amount;
            server.updatedAt = new Date();

            await this.getUserRepository(manager).save(user);
            await this.getServerRepository(manager).save(server);

            return {
                balanceRub: user.balanceRub,
                purchase: {
                    amount,
                    costRub,
                    pricePerRatingRub: RATING_PRICE_RUB,
                },
                server: {
                    id: server.id,
                    rating: server.rating,
                },
            };
        });

        await invalidateCacheNamespaces(this.fastify, [
            `payments:balance:${account.userId}`,
            `profile:${account.id}`,
            `auth:me:${account.id}`,
            "servers:user",
            "servers:list",
            "servers:search",
            "servers:detail",
            `analytics:summary:${payload.serverId}`,
            `votes:summary:${payload.serverId}`,
        ]);

        return result;
    }

    async handleWebhook(provider: EPaymentProvider, payload: Record<string, unknown>) {
        const adapter = this.getAdapter(provider);
        const webhook = adapter.normalizeWebhook(payload);
        let affectedUserId: string | null = null;

        await this.dataSource.transaction(async (manager) => {
            const topUp = await this.findTopUpForWebhook(manager, webhook);

            if (!topUp) {
                throw new NotFoundError("Пополнение для уведомления платёжного провайдера не найдено");
            }

            affectedUserId = topUp.userId;

            if (topUp.status === EBalanceTopUpStatus.Paid || topUp.status === EBalanceTopUpStatus.Overpaid) {
                topUp.providerPayload = webhook.raw;
                topUp.updatedAt = new Date();
                await this.getTopUpRepository(manager).save(topUp);
                return;
            }

            topUp.providerInvoiceId = webhook.providerInvoiceId;
            topUp.providerPayload = webhook.raw;
            topUp.updatedAt = new Date();

            if (webhook.status === EBalanceTopUpStatus.Paid || webhook.status === EBalanceTopUpStatus.Overpaid) {
                this.assertPaidAmountMatches(topUp, webhook);

                const user = await this.getUserRepository(manager).findOne({ where: { id: topUp.userId } });

                if (!user) {
                    throw new UnauthorizedError("Связанный пользователь не найден");
                }

                user.balanceRub += topUp.amountRub;
                user.updatedAt = new Date();
                topUp.status = EBalanceTopUpStatus.Paid;
                topUp.creditedAmountRub = topUp.amountRub;
                topUp.paidAt = new Date();

                await this.getUserRepository(manager).save(user);
            } else {
                topUp.status = webhook.status;
            }

            await this.getTopUpRepository(manager).save(topUp);
        });

        if (affectedUserId) {
            const account = await this.getAccountRepository().findOne({ where: { userId: affectedUserId } });
            await invalidateCacheNamespaces(this.fastify, [
                `payments:balance:${affectedUserId}`,
                `payments:topups:${affectedUserId}`,
                ...(account ? [`profile:${account.id}`, `auth:me:${account.id}`] : []),
            ]);
        }

        return { success: true };
    }

    private async findTopUpForWebhook(manager: EntityManager, webhook: NormalizedPaymentWebhook): Promise<BalanceTopUpEntity | null> {
        if (webhook.orderId) {
            const byOrderId = await this.getTopUpRepository(manager).findOne({
                where: {
                    id: webhook.orderId,
                    provider: webhook.provider,
                },
                lock: { mode: "pessimistic_write" },
            });

            if (byOrderId) {
                return byOrderId;
            }
        }

        const invoiceWithoutPrefix = webhook.providerInvoiceId.replace(/^INV-/, "");
        const invoiceCandidates = [webhook.providerInvoiceId, invoiceWithoutPrefix, `INV-${invoiceWithoutPrefix}`];

        for (const invoiceId of invoiceCandidates) {
            const topUp = await this.getTopUpRepository(manager).findOne({
                where: {
                    provider: webhook.provider,
                    providerInvoiceId: invoiceId,
                },
                lock: { mode: "pessimistic_write" },
            });

            if (topUp) {
                return topUp;
            }
        }

        return null;
    }

    private assertPaidAmountMatches(topUp: BalanceTopUpEntity, webhook: NormalizedPaymentWebhook) {
        if (webhook.amountFiat === null) {
            return;
        }

        if (webhook.currency && webhook.currency !== "RUB") {
            throw new AppError("Валюта оплаченного счета не совпадает с RUB", 400);
        }

        if (Math.abs(webhook.amountFiat - topUp.amountRub) > 0.01) {
            throw new AppError("Сумма оплаченного счета не совпадает с суммой пополнения", 400);
        }
    }
}
