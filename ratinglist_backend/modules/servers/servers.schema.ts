export const createServerSchema = {
    body: {
        type: "object",
        properties: {
            name: { type: "string", minLength: 1, maxLength: 120 },
            ip: { type: "string", minLength: 1, maxLength: 255 },
            port: { type: "integer", minimum: 1, maximum: 65535 },
            slogan: { type: ["string", "null"], maxLength: 255 },
            description: { type: ["string", "null"] },
            website: { type: ["string", "null"], maxLength: 255 },
            youtube: { type: ["string", "null"], maxLength: 255 },
            discord: { type: ["string", "null"], maxLength: 255 },
            telegram: { type: ["string", "null"], maxLength: 255 },
            vk: { type: ["string", "null"], maxLength: 255 },
            banner: {
                type: "array",
                items: { type: "string" },
            },
            logo: {
                type: "array",
                items: { type: "string" },
            },
            images: {
                type: "array",
                items: { type: "string" },
            },
            categories: {
                type: "object",
                additionalProperties: true,
            },
            versions: {
                type: "array",
                items: { type: "string" },
            },
        },
        required: ["name", "ip"],
    },
};

export const updateServerSchema = {
    body: {
        type: "object",
        properties: {
            name: { type: "string", minLength: 1, maxLength: 120 },
            ip: { type: "string", minLength: 1, maxLength: 255 },
            port: { type: "integer", minimum: 1, maximum: 65535 },
            slogan: { type: ["string", "null"], maxLength: 255 },
            description: { type: ["string", "null"] },
            website: { type: ["string", "null"], maxLength: 255 },
            youtube: { type: ["string", "null"], maxLength: 255 },
            discord: { type: ["string", "null"], maxLength: 255 },
            telegram: { type: ["string", "null"], maxLength: 255 },
            vk: { type: ["string", "null"], maxLength: 255 },
            banner: {
                type: "array",
                items: { type: "string" },
            },
            logo: {
                type: "array",
                items: { type: "string" },
            },
            images: {
                type: "array",
                items: { type: "string" },
            },
            categories: {
                type: "object",
                additionalProperties: true,
            },
            versions: {
                type: "array",
                items: { type: "string" },
            },
        },
    },
};

export const confirmMotdSchema = {
};

export const adminServerReviewSchema = {
    body: {
        type: "object",
        properties: {
            comment: { type: ["string", "null"], maxLength: 1000 },
        },
    },
};

export const managerCreateSchema = {
    body: {
        type: "object",
        properties: {
            email: { type: "string", format: "email", minLength: 3, maxLength: 255 },
        },
        required: ["email"],
    },
};

export const serverIdParamSchema = {
    params: {
        type: "object",
        properties: {
            serverId: { type: "string" },
        },
        required: ["serverId"],
    },
};

export const managerIdParamSchema = {
    params: {
        type: "object",
        properties: {
            serverId: { type: "string" },
            managerId: { type: "string" },
        },
        required: ["serverId", "managerId"],
    },
};

export const serverListSchema = {
    querystring: {
        type: "object",
        properties: {
            page: { type: "integer", minimum: 1 },
            limit: { type: "integer", minimum: 1, maximum: 50 },
            minRating: { type: "integer" },
            maxRating: { type: "integer" },
            search: { type: "string", minLength: 1, maxLength: 120 },
            sort: {
                type: "string",
                enum: ["rating_desc", "rating_asc"],
            },
        },
    },
};

export const adminServerListSchema = {
    querystring: {
        type: "object",
        properties: {
            page: { type: "integer", minimum: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100 },
            search: { type: "string", minLength: 1, maxLength: 120 },
            status: {
                type: "string",
                enum: ["motd_pending", "review_pending", "approved", "rejected"],
            },
        },
    },
};

export const serverAiSearchSchema = {
    querystring: {
        type: "object",
        properties: {
            search: { type: "string", minLength: 3, maxLength: 500 },
            limit: { type: "integer", minimum: 1, maximum: 20 },
        },
        required: ["search"],
    },
};
