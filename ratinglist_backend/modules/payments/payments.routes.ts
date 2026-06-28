import { FastifyInstance } from "fastify";

import {
    createTopUp,
    getBalance,
    getPaymentMethods,
    handleTBankWebhook,
    listTopUps,
    purchaseRating,
} from "./payments.controller";
import { createTopUpSchema, purchaseRatingSchema, webhookSchema } from "./payments.schema";

export async function paymentsRoutes(fastify: FastifyInstance) {
    fastify.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) => {
        done(null, Object.fromEntries(new URLSearchParams(body as string)));
    });

    fastify.get("/methods", getPaymentMethods);
    fastify.get("/balance", getBalance);
    fastify.get("/top-ups", listTopUps);
    fastify.post("/top-ups", { schema: createTopUpSchema }, createTopUp);
    fastify.post("/rating-purchases", { schema: purchaseRatingSchema }, purchaseRating);
    fastify.post("/webhooks/tbank", { schema: webhookSchema }, handleTBankWebhook);
}
