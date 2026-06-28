import { FastifyInstance } from "fastify";

import {
    addServerManager,
    approveAdminServer,
    confirmMotd,
    createServer,
    deleteServerManager,
    getAdminServer,
    getMyServers,
    getServerManagers,
    getServer,
    listAdminServers,
    listServers,
    rejectAdminServer,
    searchServersWithAi,
    updateAdminServer,
    updateServer,
} from "./servers.controller";
import {
    adminServerListSchema,
    adminServerReviewSchema,
    confirmMotdSchema,
    createServerSchema,
    managerCreateSchema,
    managerIdParamSchema,
    serverAiSearchSchema,
    serverIdParamSchema,
    serverListSchema,
    updateServerSchema,
} from "./servers.schema";

export async function serversRoutes(fastify: FastifyInstance) {
    fastify.get("/", { schema: serverListSchema }, listServers);
    fastify.get("/me", getMyServers);
    fastify.get("/admin/pending", { schema: adminServerListSchema }, listAdminServers);
    fastify.get("/admin/:serverId", { schema: serverIdParamSchema }, getAdminServer);
    fastify.patch("/admin/:serverId", { schema: { ...serverIdParamSchema, ...updateServerSchema } }, updateAdminServer);
    fastify.post("/admin/:serverId/approve", { schema: { ...serverIdParamSchema, ...adminServerReviewSchema } }, approveAdminServer);
    fastify.post("/admin/:serverId/reject", { schema: { ...serverIdParamSchema, ...adminServerReviewSchema } }, rejectAdminServer);
    fastify.get("/search/ai", { schema: serverAiSearchSchema }, searchServersWithAi);
    fastify.get("/:serverId", { schema: serverIdParamSchema }, getServer);
    fastify.get("/:serverId/managers", { schema: serverIdParamSchema }, getServerManagers);
    fastify.post("/", { schema: createServerSchema }, createServer);
    fastify.post("/:serverId/managers", { schema: { ...serverIdParamSchema, ...managerCreateSchema } }, addServerManager);
    fastify.patch("/:serverId", { schema: { ...serverIdParamSchema, ...updateServerSchema } }, updateServer);
    fastify.delete("/:serverId/managers/:managerId", { schema: managerIdParamSchema }, deleteServerManager);
    fastify.post("/:serverId/motd/confirm", { schema: { ...serverIdParamSchema, ...confirmMotdSchema } }, confirmMotd);
}
