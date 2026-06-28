import { FastifyInstance } from "fastify";

import {
    getConversation,
    getConversationLinks,
    getConversationMedia,
    getUnreadSummary,
    listConversations,
    markConversationRead,
    sendMessage,
    startConversation,
} from "./messages.controller";
import {
    conversationIdParamSchema,
    conversationListSchema,
    sendMessageSchema,
    serverIdParamSchema,
} from "./messages.schema";

export async function messagesRoutes(fastify: FastifyInstance) {
    fastify.get("/conversations", { schema: conversationListSchema }, listConversations);
    fastify.get("/unread-summary", getUnreadSummary);
    fastify.get("/conversations/:conversationId", { schema: conversationIdParamSchema }, getConversation);
    fastify.get("/conversations/:conversationId/media", { schema: conversationIdParamSchema }, getConversationMedia);
    fastify.get("/conversations/:conversationId/links", { schema: conversationIdParamSchema }, getConversationLinks);
    fastify.post("/server/:serverId/start", { schema: serverIdParamSchema }, startConversation);
    fastify.post(
        "/conversations/:conversationId/messages",
        { schema: { ...conversationIdParamSchema, ...sendMessageSchema } },
        sendMessage,
    );
    fastify.post("/conversations/:conversationId/read", { schema: conversationIdParamSchema }, markConversationRead);
}
