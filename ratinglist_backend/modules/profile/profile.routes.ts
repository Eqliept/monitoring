import { FastifyInstance } from "fastify";

import {
    getProfile,
    updateProfile,
    uploadAvatar,
} from "./profile.controller";

export async function profileRoutes(fastify: FastifyInstance) {
    fastify.get("/me", getProfile);

    fastify.patch(
        "/me",
        {
            schema: {
                body: {
                    type: "object",
                    properties: {
                        username: { type: ["string", "null"] },
                        firstName: { type: ["string", "null"] },
                        lastName: { type: ["string", "null"] },
                        telegram: { type: ["string", "null"] },
                    },
                },
            },
        },
        updateProfile,
    );

    fastify.post(
        "/avatar",
        {
            schema: {
                body: {
                    type: "object",
                    properties: {
                        dataUrl: { type: "string" },
                    },
                    required: ["dataUrl"],
                },
            },
        },
        uploadAvatar,
    );
}
