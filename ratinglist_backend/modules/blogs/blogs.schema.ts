const blogPostDraftBodySchema = {
    type: "object",
    properties: {
        title: {
            type: "string",
            minLength: 1,
            maxLength: 180,
        },
        imageUrl: {
            type: "string",
            minLength: 1,
        },
        summary: {
            type: "string",
            minLength: 1,
            maxLength: 220,
        },
        content: {
            type: "string",
            minLength: 1,
        },
    },
    required: ["title", "imageUrl", "summary", "content"],
    additionalProperties: false,
};

export const blogPostCreateSchema = {
    body: blogPostDraftBodySchema,
};

export const blogPostUpdateSchema = {
    params: {
        type: "object",
        properties: {
            postId: { type: "string", minLength: 1 },
        },
        required: ["postId"],
    },
    body: blogPostDraftBodySchema,
};

export const blogPostParamSchema = {
    params: {
        type: "object",
        properties: {
            postId: { type: "string", minLength: 1 },
        },
        required: ["postId"],
    },
};
