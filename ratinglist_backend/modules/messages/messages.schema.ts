export const serverIdParamSchema = {
    params: {
        type: "object",
        properties: {
            serverId: { type: "string", minLength: 1 },
        },
        required: ["serverId"],
    },
};

export const conversationIdParamSchema = {
    params: {
        type: "object",
        properties: {
            conversationId: { type: "string", minLength: 1 },
        },
        required: ["conversationId"],
    },
};

export const conversationListSchema = {
    querystring: {
        type: "object",
        properties: {
            serverId: { type: "string", minLength: 1 },
            search: { type: "string", minLength: 1, maxLength: 120 },
            page: { type: "integer", minimum: 1 },
            limit: { type: "integer", minimum: 1, maximum: 50 },
        },
    },
};

export const sendMessageSchema = {
    body: {
        type: "object",
        properties: {
            text: { type: ["string", "null"], maxLength: 5000 },
            attachments: {
                type: "array",
                maxItems: 10,
                items: {
                    type: "object",
                    properties: {
                        type: { type: "string", enum: ["image", "video", "gif"] },
                        url: { type: "string", minLength: 1 },
                        publicId: { type: ["string", "null"] },
                        mimeType: { type: "string", minLength: 1 },
                        sizeBytes: { type: "integer", minimum: 1, maximum: 5 * 1024 * 1024 },
                    },
                    required: ["type", "url", "mimeType", "sizeBytes"],
                    additionalProperties: false,
                },
            },
        },
        additionalProperties: false,
    },
};
