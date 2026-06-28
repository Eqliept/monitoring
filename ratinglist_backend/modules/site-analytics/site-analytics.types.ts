export type SiteAnalyticsPeriod = "7d" | "30d" | "90d" | "12m";

export interface SiteAnalyticsSessionBody {
    visitorId?: string;
    path?: string;
    referrer?: string;
}

export interface SiteAnalyticsHeartbeatParams {
    sessionId: string;
}

export interface SiteAnalyticsHeartbeatBody {
    visitorId?: string;
    path?: string;
}

export interface SiteAnalyticsOverviewQuery {
    period?: SiteAnalyticsPeriod;
}

export interface SiteAnalyticsRecentTopUpsQuery {
    limit?: number;
}
