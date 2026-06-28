import { FastifyInstance } from "fastify";

import {
    createServerTaxonomyItem,
    deleteServerTaxonomyItem,
    listServerTaxonomy,
    listServerTaxonomyAdmin,
    reorderServerTaxonomyItems,
    updateServerTaxonomyItem,
} from "./server-taxonomy.controller";
import {
    serverTaxonomyCreateSchema,
    serverTaxonomyItemParamSchema,
    serverTaxonomyReorderSchema,
    serverTaxonomyUpdateSchema,
} from "./server-taxonomy.schema";

export async function serverTaxonomyRoutes(fastify: FastifyInstance) {
    fastify.get("/", listServerTaxonomy);
    fastify.get("/admin", listServerTaxonomyAdmin);
    fastify.post("/", { schema: serverTaxonomyCreateSchema }, createServerTaxonomyItem);
    fastify.patch("/:itemId", { schema: serverTaxonomyUpdateSchema }, updateServerTaxonomyItem);
    fastify.delete("/:itemId", { schema: serverTaxonomyItemParamSchema }, deleteServerTaxonomyItem);
    fastify.post("/reorder", { schema: serverTaxonomyReorderSchema }, reorderServerTaxonomyItems);
}
