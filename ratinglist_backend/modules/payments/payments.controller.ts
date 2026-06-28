import { FastifyReply, FastifyRequest } from "fastify";

import { EPaymentProvider } from "../../database/entities/balance-top-up.entity";
import { CreateTopUpBody, PurchaseRatingBody } from "./payments.types";
import { PaymentsService } from "./payments.service/payments.service";

function getPaymentsService(request: FastifyRequest) {
    return new PaymentsService(request.server);
}

export async function getPaymentMethods(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(getPaymentsService(request).getMethods());
}

export async function getBalance(request: FastifyRequest, reply: FastifyReply) {
    const token = request.cookies["access_token"];
    return reply.send(await getPaymentsService(request).getBalance(token));
}

export async function listTopUps(request: FastifyRequest, reply: FastifyReply) {
    const token = request.cookies["access_token"];
    return reply.send(await getPaymentsService(request).listTopUps(token));
}

export async function createTopUp(
    request: FastifyRequest<{ Body: CreateTopUpBody }>,
    reply: FastifyReply,
) {
    const token = request.cookies["access_token"];
    return reply.status(201).send(await getPaymentsService(request).createTopUp(token, request.body));
}

export async function purchaseRating(
    request: FastifyRequest<{ Body: PurchaseRatingBody }>,
    reply: FastifyReply,
) {
    const token = request.cookies["access_token"];
    return reply.status(201).send(await getPaymentsService(request).purchaseRating(token, request.body));
}

export async function handleTBankWebhook(
    request: FastifyRequest<{ Body: Record<string, unknown> }>,
    reply: FastifyReply,
) {
    await getPaymentsService(request).handleWebhook(EPaymentProvider.TBank, request.body);
    return reply.type("text/plain").send("OK");
}
