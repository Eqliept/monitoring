export const siteAnalyticsSessionSchema = {
    body: {
        type: "object",
        properties: {
            visitorId: { type: "string", minLength: 1, maxLength: 120 },
            path: { type: "string", minLength: 1, maxLength: 500 },
            referrer: { type: "string", maxLength: 1000 },
        },
        additionalProperties: false,
    },
};

export const siteAnalyticsHeartbeatSchema = {
    params: {
        type: "object",
        properties: {
            sessionId: { type: "string", minLength: 1 },
        },
        required: ["sessionId"],
    },
    body: {
        type: "object",
        properties: {
            visitorId: { type: "string", minLength: 1, maxLength: 120 },
            path: { type: "string", minLength: 1, maxLength: 500 },
        },
        additionalProperties: false,
    },
};

export const siteAnalyticsOverviewSchema = {
    querystring: {
        type: "object",
        properties: {
            period: {
                type: "string",
                enum: ["7d", "30d", "90d", "12m"],
            },
        },
    },
};

export const siteAnalyticsRecentTopUpsSchema = {
    querystring: {
        type: "object",
        properties: {
            limit: {
                type: "integer",
                minimum: 1,
                maximum: 20,
            },
        },
    },
};
