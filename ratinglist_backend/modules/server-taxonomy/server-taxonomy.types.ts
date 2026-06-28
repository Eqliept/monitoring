import { EServerTaxonomyVariant } from "../../database/entities/server-taxonomy-item.entity";

export type ServerTaxonomyGroupKey =
    | "versions"
    | "serverTypes"
    | "gameModes"
    | "rules"
    | "systems"
    | "miniGames"
    | "mods";

export interface ServerTaxonomyParams {
    itemId: string;
}

export interface ServerTaxonomyCreateBody {
    groupKey: ServerTaxonomyGroupKey;
    groupLabel?: string;
    name: string;
    variant?: EServerTaxonomyVariant;
    isActive?: boolean;
}

export interface ServerTaxonomyUpdateBody {
    groupLabel?: string;
    name?: string;
    variant?: EServerTaxonomyVariant;
    isActive?: boolean;
}

export interface ServerTaxonomyReorderBody {
    groupKey: ServerTaxonomyGroupKey;
    itemIds: string[];
}
