import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";

async function localePlugin(fastify: FastifyInstance) {
    fastify.decorateRequest("locale", null);
}

export default fp(localePlugin);
