import { FastifyReply, FastifyRequest } from "fastify";

import { MessagesService } from "./messages.service/messages.service";
import { ConversationListQuery, SendMessagePayload } from "./messages.types";

function getMessagesService(request: FastifyRequest) {
    return new MessagesService(request.server);
}

export async function startConversation(
    request: FastifyRequest<{ Params: { serverId: string } }>,
    reply: FastifyReply,
) {
    const service = getMessagesService(request);
    const token = request.cookies["access_token"];
    return reply.status(201).send(await service.startConversation(token, request.params.serverId));
}

export async function listConversations(
    request: FastifyRequest<{ Querystring: ConversationListQuery }>,
    reply: FastifyReply,
) {
    const service = getMessagesService(request);
    const token = request.cookies["access_token"];
    return reply.send(await service.listConversations(token, request.query));
}

export async function getConversation(
    request: FastifyRequest<{ Params: { conversationId: string } }>,
    reply: FastifyReply,
) {
    const service = getMessagesService(request);
    const token = request.cookies["access_token"];
    return reply.send(await service.getConversation(token, request.params.conversationId));
}

export async function sendMessage(
    request: FastifyRequest<{ Params: { conversationId: string }; Body: SendMessagePayload }>,
    reply: FastifyReply,
) {
    const service = getMessagesService(request);
    const token = request.cookies["access_token"];
    return reply.status(201).send(await service.sendMessage(token, request.params.conversationId, request.body));
}

export async function markConversationRead(
    request: FastifyRequest<{ Params: { conversationId: string } }>,
    reply: FastifyReply,
) {
    const service = getMessagesService(request);
    const token = request.cookies["access_token"];
    return reply.send(await service.markConversationRead(token, request.params.conversationId));
}

export async function getConversationMedia(
    request: FastifyRequest<{ Params: { conversationId: string } }>,
    reply: FastifyReply,
) {
    const service = getMessagesService(request);
    const token = request.cookies["access_token"];
    return reply.send(await service.getConversationMedia(token, request.params.conversationId));
}

export async function getConversationLinks(
    request: FastifyRequest<{ Params: { conversationId: string } }>,
    reply: FastifyReply,
) {
    const service = getMessagesService(request);
    const token = request.cookies["access_token"];
    return reply.send(await service.getConversationLinks(token, request.params.conversationId));
}

export async function getUnreadSummary(request: FastifyRequest, reply: FastifyReply) {
    const service = getMessagesService(request);
    const token = request.cookies["access_token"];
    return reply.send(await service.getUnreadSummary(token));
}
