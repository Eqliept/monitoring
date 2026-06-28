import { FastifyInstance } from "fastify";

import { getServerVotes, voteForServer } from "./votes.controller";
import { voteListQuerySchema, voteServerParamsSchema } from "./votes.schema";

export async function votesRoutes(fastify: FastifyInstance) {
    fastify.get("/:serverId", { schema: { ...voteServerParamsSchema, ...voteListQuerySchema } }, getServerVotes);
    fastify.post("/:serverId", { schema: voteServerParamsSchema }, voteForServer);
}
