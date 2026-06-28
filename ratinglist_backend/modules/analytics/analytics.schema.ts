export const analyticsServerParamsSchema = {
    params: {
        type: "object",
        properties: {
            serverId: { type: "string", minLength: 1 },
        },
        required: ["serverId"],
    },
};

export const analyticsPlayersQuerySchema = {
    querystring: {
        type: "object",
        properties: {
            period: {
                type: "string",
                enum: ["day", "week", "month", "year"],
            },
        },
    },
};

export const analyticsViewSchema = {
    body: {
        type: "object",
        properties: {
            visitorId: { type: "string", minLength: 1, maxLength: 100 },
        },
    },
};
