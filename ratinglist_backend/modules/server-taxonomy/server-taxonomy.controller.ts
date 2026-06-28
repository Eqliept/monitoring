import { FastifyReply, FastifyRequest } from "fastify";

import { ServerTaxonomyService } from "./server-taxonomy.service/server-taxonomy.service";
import {
    ServerTaxonomyCreateBody,
    ServerTaxonomyParams,
    ServerTaxonomyReorderBody,
    ServerTaxonomyUpdateBody,
} from "./server-taxonomy.types";

function getServerTaxonomyService(request: FastifyRequest) {
    return new ServerTaxonomyService(request.server);
}

export async function listServerTaxonomy(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await getServerTaxonomyService(request).listItems());
}

export async function listServerTaxonomyAdmin(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await getServerTaxonomyService(request).listItems({ includeInactive: true }));
}

export async function createServerTaxonomyItem(
    request: FastifyRequest<{ Body: ServerTaxonomyCreateBody }>,
    reply: FastifyReply,
) {
    return reply.status(201).send(await getServerTaxonomyService(request).createItem(request.body));
}

export async function updateServerTaxonomyItem(
    request: FastifyRequest<{ Params: ServerTaxonomyParams; Body: ServerTaxonomyUpdateBody }>,
    reply: FastifyReply,
) {
    return reply.send(await getServerTaxonomyService(request).updateItem(request.params.itemId, request.body));
}

export async function deleteServerTaxonomyItem(
    request: FastifyRequest<{ Params: ServerTaxonomyParams }>,
    reply: FastifyReply,
) {
    return reply.send(await getServerTaxonomyService(request).deleteItem(request.params.itemId));
}

export async function reorderServerTaxonomyItems(
    request: FastifyRequest<{ Body: ServerTaxonomyReorderBody }>,
    reply: FastifyReply,
) {
    return reply.send(await getServerTaxonomyService(request).reorderItems(request.body));
}
