import { FastifyReply, FastifyRequest } from "fastify";

import { ProfileService } from "./profile.service/profile.service";

function getProfileService(request: FastifyRequest) {
    return new ProfileService(request.server);
}

export async function getProfile(request: FastifyRequest, reply: FastifyReply) {
    const profile = getProfileService(request);
    const token = request.cookies["access_token"];
    return reply.send(await profile.getProfile(token));
}

export async function updateProfile(
    request: FastifyRequest<{ Body: { username?: string | null; firstName?: string | null; lastName?: string | null; telegram?: string | null } }>,
    reply: FastifyReply,
) {
    const profile = getProfileService(request);
    const token = request.cookies["access_token"];
    return reply.send(await profile.updateProfile(token, request.body));
}

export async function uploadAvatar(
    request: FastifyRequest<{ Body: { dataUrl: string } }>,
    reply: FastifyReply,
) {
    const profile = getProfileService(request);
    const token = request.cookies["access_token"];
    return reply.send(await profile.uploadAvatar(token, request.body));
}
