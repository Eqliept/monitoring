import { FastifyInstance } from "fastify";

import { uploadChatMedia, uploadImage } from "./media.controller";

export async function mediaRoutes(fastify: FastifyInstance) {
    fastify.post(
        "/image",
        {
            bodyLimit: 20 * 1024 * 1024,
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
        uploadImage,
    );
    fastify.post(
        "/chat",
        {
            bodyLimit: 8 * 1024 * 1024,
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
        uploadChatMedia,
    );
}
