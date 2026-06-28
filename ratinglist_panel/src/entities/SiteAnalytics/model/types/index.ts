export type AnalyticsPeriodKey = "7d" | "30d" | "90d" | "12m";

export type SiteAnalyticsMetricId =
  | "visits"
  | "averageTimeSeconds"
  | "registrations"
  | "revenueRub";

export interface SiteAnalyticsMetric {
  value: number;
  trendValue: number;
  trendPercent: number;
}

export interface SiteAnalyticsPoint {
  time: string;
  visits: number;
  registrations: number;
}

export interface SiteAnalyticsOverviewResponse {
  period: AnalyticsPeriodKey;
  range: {
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
  };
  metrics: Record<SiteAnalyticsMetricId, SiteAnalyticsMetric>;
  points: SiteAnalyticsPoint[];
}

export interface SiteAnalyticsMetricView {
  id: SiteAnalyticsMetricId;
  label: string;
  value: string;
  change: string;
  isNegative: boolean;
}

export interface SiteAnalyticsChartPoint {
  label: string;
  value: number;
  secondaryValue: number;
}
