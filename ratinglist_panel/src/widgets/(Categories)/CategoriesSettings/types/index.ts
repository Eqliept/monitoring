export type TaxonomyGroupKey =
  | "versions"
  | "serverTypes"
  | "gameModes"
  | "rules"
  | "systems"
  | "miniGames"
  | "mods";

export type TaxonomyVariant = "default" | "primary";

export interface TaxonomyItem {
  id: string;
  groupKey: TaxonomyGroupKey;
  groupLabel: string;
  name: string;
  type: TaxonomyVariant;
  variant: TaxonomyVariant;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaxonomyGroup {
  key: TaxonomyGroupKey;
  label: string;
  items: TaxonomyItem[];
}

export interface TaxonomyResponse {
  groups: TaxonomyGroup[];
}

export interface TaxonomyCreatePayload {
  groupKey: TaxonomyGroupKey;
  groupLabel?: string;
  name: string;
  variant?: TaxonomyVariant;
  isActive?: boolean;
}

export interface TaxonomyUpdatePayload {
  name?: string;
  groupLabel?: string;
  variant?: TaxonomyVariant;
  isActive?: boolean;
}
