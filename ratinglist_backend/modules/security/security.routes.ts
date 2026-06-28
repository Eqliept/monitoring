import { FastifyInstance } from "fastify";

import {
    disableTwoFactor,
    getSecurityStatus,
    startTwoFactorSetup,
} from "./security.controller";

export async function securityRoutes(fastify: FastifyInstance) {
    fastify.get("/two-factor/status", getSecurityStatus);

    fastify.post(
        "/two-factor/setup/start",
        {
            schema: {
                body: {
                    type: "object",
                    properties: {
                        password: { type: "string", minLength: 4, maxLength: 128 },
                    },
                    required: ["password"],
                },
            },
        },
        startTwoFactorSetup,
    );

    fastify.post("/two-factor/disable", disableTwoFactor);
}
