import { EPaymentProvider } from "../../database/entities/balance-top-up.entity";

export const createTopUpSchema = {
    body: {
        type: "object",
        properties: {
            amountRub: {
                type: "integer",
                minimum: 100,
            },
            method: {
                type: "string",
                enum: [EPaymentProvider.TBank],
            },
        },
        required: ["amountRub", "method"],
        additionalProperties: false,
    },
};

export const purchaseRatingSchema = {
    body: {
        type: "object",
        properties: {
            serverId: {
                type: "string",
                minLength: 1,
            },
            amount: {
                type: "integer",
                minimum: 1,
                maximum: 1000,
            },
        },
        required: ["serverId", "amount"],
        additionalProperties: false,
    },
};

export const webhookSchema = {
    body: {
        type: "object",
        additionalProperties: true,
    },
};
