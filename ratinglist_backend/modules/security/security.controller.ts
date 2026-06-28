import { FastifyReply, FastifyRequest } from "fastify";

import { AuthService } from "../auth/auth.service/auth.service";

function getAuth(request: FastifyRequest) {
    return new AuthService(request.server);
}

export async function getSecurityStatus(request: FastifyRequest, reply: FastifyReply) {
    const auth = getAuth(request);
    const token = request.cookies["access_token"];
    return reply.send(await auth.getSecurityStatus(token));
}

export async function startTwoFactorSetup(
    request: FastifyRequest<{ Body: { password: string } }>,
    reply: FastifyReply,
) {
    const auth = getAuth(request);
    const token = request.cookies["access_token"];
    return reply.send(await auth.startTwoFactorSetup(token, request.body.password));
}

export async function disableTwoFactor(request: FastifyRequest, reply: FastifyReply) {
    const auth = getAuth(request);
    const token = request.cookies["access_token"];
    return reply.send(await auth.disableTwoFactor(token));
}
