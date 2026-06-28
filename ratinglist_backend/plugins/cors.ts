import fp from "fastify-plugin";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

const allowedOrigins = new Set(
    [
        process.env.FRONTEND_URL,
        process.env.NEXT_PUBLIC_FRONTEND_URL,
        process.env.ADMIN_PANEL_URL,
        process.env.VITE_PANEL_URL,
        "http://localhost:3001",
        "http://localhost:5173",
    ].filter((origin): origin is string => Boolean(origin)),
);
const allowedHeaders = "Content-Type, Authorization, X-Requested-With";
const allowedMethods = "GET,POST,PUT,PATCH,DELETE,OPTIONS";

function applyCors(reply: FastifyReply, origin?: string) {
    if (origin && allowedOrigins.has(origin)) {
        reply.header("Access-Control-Allow-Origin", origin);
        reply.header("Access-Control-Allow-Credentials", "true");
        reply.header("Vary", "Origin");
        reply.header("Access-Control-Allow-Headers", allowedHeaders);
        reply.header("Access-Control-Allow-Methods", allowedMethods);
    }
}

async function corsPlugin(fastify: FastifyInstance) {
    fastify.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
        applyCors(reply, request.headers.origin);

        if (request.method === "OPTIONS") {
            return reply.code(204).send();
        }
    });
}

export default fp(corsPlugin);
