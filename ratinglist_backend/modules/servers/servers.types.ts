export type ServerSort = "rating_desc" | "rating_asc";
export type ServerModerationStatus = "motd_pending" | "review_pending" | "approved" | "rejected";

export interface ServerManagerPayload {
    email: string;
}

export interface CreateServerPayload {
    name: string;
    ip: string;
    port?: number;
    slogan?: string | null;
    description?: string | null;
    website?: string | null;
    youtube?: string | null;
    discord?: string | null;
    telegram?: string | null;
    vk?: string | null;
    banner?: string[];
    logo?: string[];
    images?: string[];
    categories?: Record<string, unknown>;
    versions?: string[];
}

export interface UpdateServerPayload extends Partial<CreateServerPayload> {}

export interface AdminServerListQuery {
    page?: number;
    limit?: number;
    status?: ServerModerationStatus;
    search?: string;
}

export interface AdminServerReviewPayload {
    comment?: string | null;
}


export interface ServerListQuery {
    page?: number;
    limit?: number;
    minRating?: number;
    maxRating?: number;
    sort?: ServerSort;
    search?: string;
}

export interface ServerAiSearchQuery {
    search: string;
    limit?: number;
}
