export type AnalyticsPeriod = "day" | "week" | "month" | "year";
export type AnalyticsEventType = "view" | "ip-copy" | "vote";

export interface AnalyticsServerParams {
    serverId: string;
}

export interface AnalyticsPlayersQuery {
    period?: AnalyticsPeriod;
}

export interface AnalyticsViewPayload {
    visitorId?: string;
}
