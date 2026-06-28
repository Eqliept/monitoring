import type { AnalyticsPeriodKey, SiteAnalyticsMetricId } from "../types";

export const siteAnalyticsPeriodOptions: Array<{
  value: AnalyticsPeriodKey;
  label: string;
}> = [
  { value: "7d", label: "Последние 7 дней" },
  { value: "30d", label: "Последние 30 дней" },
  { value: "90d", label: "Последние 90 дней" },
  { value: "12m", label: "Последние 12 месяцев" },
];

export const siteAnalyticsMetricLabels: Record<SiteAnalyticsMetricId, string> = {
  visits: "Количество посещений",
  averageTimeSeconds: "Среднее время",
  registrations: "Регистрации",
  revenueRub: "Доход",
};

export const siteAnalyticsMetricIds: SiteAnalyticsMetricId[] = [
  "visits",
  "averageTimeSeconds",
  "registrations",
  "revenueRub",
];
