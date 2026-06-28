export const loginSchema = {
    body: {
        type: "object",
        properties: {
            email: { type: "string", format: "email" },
            redirectTo: { type: "string" },
        },
        required: ["email"]
    }
}

export const magicConsumeSchema = {
    querystring: {
        type: "object",
        properties: {
            token: { type: "string" },
        },
        required: ["token"]
    }
}

export const verifySchema = {
    body: {
        type: "object",
        properties: {
            email: { type: "string", format: "email" },
            code: { type: "string", minLength: 6, maxLength: 6 },
        },
        required: ["email", "code"]
    }
}
