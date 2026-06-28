import { FastifyReply, FastifyRequest } from "fastify";

import { VotesService } from "./votes.service/votes.service";
import { VoteListQuery, VoteServerParams } from "./votes.types";

function getVotesService(request: FastifyRequest) {
    return new VotesService(request.server);
}

export async function getServerVotes(
    request: FastifyRequest<{ Params: VoteServerParams; Querystring: VoteListQuery }>,
    reply: FastifyReply,
) {
    const service = getVotesService(request);
    const token = request.cookies["access_token"];
    return reply.send(await service.getServerVotes(request.params.serverId, request.query, token));
}

export async function voteForServer(
    request: FastifyRequest<{ Params: VoteServerParams }>,
    reply: FastifyReply,
) {
    const service = getVotesService(request);
    const token = request.cookies["access_token"];
    return reply.send(await service.createVote(request.params.serverId, token));
}
