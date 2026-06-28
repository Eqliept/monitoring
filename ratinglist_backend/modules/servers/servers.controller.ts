import { FastifyReply, FastifyRequest } from "fastify";

import { UnauthorizedError } from "../../errors/appErrors";
import { ServersService } from "./servers.service/servers.service";
import {
    AdminServerListQuery,
    AdminServerReviewPayload,
    CreateServerPayload,
    ServerAiSearchQuery,
    ServerListQuery,
    ServerManagerPayload,
    UpdateServerPayload,
} from "./servers.types";

const FRONTEND_URL = process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:3001";

function getServersService(request: FastifyRequest) {
    return new ServersService(request.server);
}

function buildFrontendAuthUrl() {
    return new URL("/auth", FRONTEND_URL).toString();
}

function redirectToAuth(reply: FastifyReply) {
    return reply.redirect(buildFrontendAuthUrl());
}

export async function listServers(
    request: FastifyRequest<{ Querystring: ServerListQuery }>,
    reply: FastifyReply,
) {
    const service = getServersService(request);
    return reply.send(await service.listServers(request.query));
}

export async function searchServersWithAi(
    request: FastifyRequest<{ Querystring: ServerAiSearchQuery }>,
    reply: FastifyReply,
) {
    const service = getServersService(request);
    return reply.send(await service.searchServersWithAi(request.query));
}

export async function getServer(
    request: FastifyRequest<{ Params: { serverId: string } }>,
    reply: FastifyReply,
) {
    const service = getServersService(request);
    const token = request.cookies["access_token"];
    return reply.send(await service.getServer(request.params.serverId, token));
}

export async function getMyServers(request: FastifyRequest, reply: FastifyReply) {
    try {
        const service = getServersService(request);
        const token = request.cookies["access_token"];
        return reply.send(await service.getMyServers(token));
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return redirectToAuth(reply);
        }

        throw error;
    }
}

export async function createServer(
    request: FastifyRequest<{ Body: CreateServerPayload }>,
    reply: FastifyReply,
) {
    try {
        const service = getServersService(request);
        const token = request.cookies["access_token"];
        return reply.status(201).send(await service.createServer(token, request.body));
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return redirectToAuth(reply);
        }

        throw error;
    }
}

export async function getServerManagers(
    request: FastifyRequest<{ Params: { serverId: string } }>,
    reply: FastifyReply,
) {
    try {
        const service = getServersService(request);
        const token = request.cookies["access_token"];
        return reply.send(await service.getServerManagers(token, request.params.serverId));
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return redirectToAuth(reply);
        }

        throw error;
    }
}

export async function addServerManager(
    request: FastifyRequest<{ Params: { serverId: string }; Body: ServerManagerPayload }>,
    reply: FastifyReply,
) {
    try {
        const service = getServersService(request);
        const token = request.cookies["access_token"];
        return reply.status(201).send(await service.addServerManager(token, request.params.serverId, request.body));
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return redirectToAuth(reply);
        }

        throw error;
    }
}

export async function updateServer(
    request: FastifyRequest<{ Params: { serverId: string }; Body: UpdateServerPayload }>,
    reply: FastifyReply,
) {
    try {
        const service = getServersService(request);
        const token = request.cookies["access_token"];
        return reply.send(await service.updateServer(token, request.params.serverId, request.body));
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return redirectToAuth(reply);
        }

        throw error;
    }
}

export async function deleteServerManager(
    request: FastifyRequest<{ Params: { serverId: string; managerId: string } }>,
    reply: FastifyReply,
) {
    try {
        const service = getServersService(request);
        const token = request.cookies["access_token"];
        return reply.send(await service.deleteServerManager(token, request.params.serverId, request.params.managerId));
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return redirectToAuth(reply);
        }

        throw error;
    }
}

export async function confirmMotd(
    request: FastifyRequest<{ Params: { serverId: string } }>,
    reply: FastifyReply,
) {
    try {
        const service = getServersService(request);
        const token = request.cookies["access_token"];
        return reply.send(await service.confirmMotd(token, request.params.serverId));
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return redirectToAuth(reply);
        }

        throw error;
    }
}

export async function listAdminServers(
    request: FastifyRequest<{ Querystring: AdminServerListQuery }>,
    reply: FastifyReply,
) {
    const service = getServersService(request);
    const token = request.cookies["access_token"];
    return reply.send(await service.listAdminServers(token, request.query));
}

export async function getAdminServer(
    request: FastifyRequest<{ Params: { serverId: string } }>,
    reply: FastifyReply,
) {
    const service = getServersService(request);
    const token = request.cookies["access_token"];
    return reply.send(await service.getAdminServer(token, request.params.serverId));
}

export async function updateAdminServer(
    request: FastifyRequest<{ Params: { serverId: string }; Body: UpdateServerPayload }>,
    reply: FastifyReply,
) {
    const service = getServersService(request);
    const token = request.cookies["access_token"];
    return reply.send(await service.updateAdminServer(token, request.params.serverId, request.body));
}

export async function approveAdminServer(
    request: FastifyRequest<{ Params: { serverId: string }; Body: AdminServerReviewPayload }>,
    reply: FastifyReply,
) {
    const service = getServersService(request);
    const token = request.cookies["access_token"];
    return reply.send(await service.approveAdminServer(token, request.params.serverId, request.body));
}

export async function rejectAdminServer(
    request: FastifyRequest<{ Params: { serverId: string }; Body: AdminServerReviewPayload }>,
    reply: FastifyReply,
) {
    const service = getServersService(request);
    const token = request.cookies["access_token"];
    return reply.send(await service.rejectAdminServer(token, request.params.serverId, request.body));
}
