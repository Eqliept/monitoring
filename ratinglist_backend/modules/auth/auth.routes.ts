import { FastifyInstance } from "fastify";

import {
    login,
    logout,
    magicConsume,
    me,
    oauthCallback,
    oauthStart,
    refresh,
    verifyTwoFactor,
} from "./auth.controller";
import { loginSchema, magicConsumeSchema } from "./auth.schema";

export async function authRoutes(fastify: FastifyInstance) {
    fastify.post("/login", { schema: loginSchema }, login);
    fastify.post("/refresh", refresh);
    fastify.post("/logout", logout);
    fastify.get("/me", me);
    fastify.get("/magic/consume", { schema: magicConsumeSchema }, magicConsume);

    fastify.get("/oauth/:provider/start", oauthStart);
    fastify.get("/oauth/:provider/callback", oauthCallback);
    fastify.post(
        "/two-factor/verify",
        {
            schema: {
                body: {
                    type: "object",
                    properties: {
                        challenge: { type: "string" },
                        password: { type: "string", minLength: 4, maxLength: 128 },
                    },
                    required: ["challenge", "password"],
                },
            },
        },
        verifyTwoFactor,
    );
}
