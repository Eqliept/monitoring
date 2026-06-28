export const voteServerParamsSchema = {
    params: {
        type: "object",
        properties: {
            serverId: { type: "string" },
        },
        required: ["serverId"],
    },
};

export const voteListQuerySchema = {
    querystring: {
        type: "object",
        properties: {
            page: { type: "integer", minimum: 1 },
            limit: { type: "integer", minimum: 1, maximum: 50 },
        },
    },
};
