import { EServerTaxonomyVariant } from "../../database/entities/server-taxonomy-item.entity";

const groupKeys = ["versions", "serverTypes", "gameModes", "rules", "systems", "miniGames", "mods"];

export const serverTaxonomyCreateSchema = {
    body: {
        type: "object",
        properties: {
            groupKey: {
                type: "string",
                enum: groupKeys,
            },
            groupLabel: {
                type: "string",
                minLength: 1,
                maxLength: 80,
            },
            name: {
                type: "string",
                minLength: 1,
                maxLength: 120,
            },
            variant: {
                type: "string",
                enum: Object.values(EServerTaxonomyVariant),
            },
            isActive: {
                type: "boolean",
            },
        },
        required: ["groupKey", "name"],
        additionalProperties: false,
    },
};

export const serverTaxonomyUpdateSchema = {
    params: {
        type: "object",
        properties: {
            itemId: { type: "string", minLength: 1 },
        },
        required: ["itemId"],
    },
    body: {
        type: "object",
        properties: {
            groupLabel: {
                type: "string",
                minLength: 1,
                maxLength: 80,
            },
            name: {
                type: "string",
                minLength: 1,
                maxLength: 120,
            },
            variant: {
                type: "string",
                enum: Object.values(EServerTaxonomyVariant),
            },
            isActive: {
                type: "boolean",
            },
        },
        additionalProperties: false,
    },
};

export const serverTaxonomyItemParamSchema = {
    params: {
        type: "object",
        properties: {
            itemId: { type: "string", minLength: 1 },
        },
        required: ["itemId"],
    },
};

export const serverTaxonomyReorderSchema = {
    body: {
        type: "object",
        properties: {
            groupKey: {
                type: "string",
                enum: groupKeys,
            },
            itemIds: {
                type: "array",
                items: {
                    type: "string",
                    minLength: 1,
                },
                minItems: 1,
            },
        },
        required: ["groupKey", "itemIds"],
        additionalProperties: false,
    },
};
