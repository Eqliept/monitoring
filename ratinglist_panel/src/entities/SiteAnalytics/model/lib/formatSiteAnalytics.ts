import {
  siteAnalyticsMetricIds,
  siteAnalyticsMetricLabels,
} from "../constants";
import type {
  AnalyticsPeriodKey,
  SiteAnalyticsChartPoint,
  SiteAnalyticsMetric,
  SiteAnalyticsMetricId,
  SiteAnalyticsMetricView,
  SiteAnalyticsOverviewResponse,
} from "../types";

const numberFormatter = new Intl.NumberFormat("ru-RU");
const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
  style: "currency",
  currency: "RUB",
});
const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds} сек`;
  }

  return `${minutes} мин ${seconds} сек`;
}

function formatSiteAnalyticsMetricValue(
  id: SiteAnalyticsMetricId,
  value: number,
): string {
  switch (id) {
    case "averageTimeSeconds":
      return formatDuration(value);
    case "revenueRub":
      return moneyFormatter.format(value);
    default:
      return numberFormatter.format(value);
  }
}

export function formatSiteAnalyticsTrend(metric: SiteAnalyticsMetric): string {
  const sign = metric.trendPercent >= 0 ? "+" : "-";
  const value = Math.abs(metric.trendPercent);

  return `${sign}${value.toLocaleString("ru-RU", {
    maximumFractionDigits: 1,
  })}%`;
}

export function formatSiteAnalyticsPointLabel(
  time: string,
  period: AnalyticsPeriodKey,
): string {
  const date = new Date(time);

  return date.toLocaleDateString("ru-RU", {
    month: "short",
    ...(period === "12m" ? {} : { day: "numeric" }),
  });
}

export function buildSiteAnalyticsPeriodLabel(
  data: SiteAnalyticsOverviewResponse | undefined,
): string {
  if (!data) {
    return "Загрузка периода";
  }

  return `${dateFormatter.format(new Date(data.range.from))} — ${dateFormatter.format(new Date(data.range.to))}`;
}

export function buildSiteAnalyticsMetrics(
  data: SiteAnalyticsOverviewResponse | undefined,
): SiteAnalyticsMetricView[] {
  return siteAnalyticsMetricIds.map((id) => {
    const metric = data?.metrics[id];

    return {
      id,
      label: siteAnalyticsMetricLabels[id],
      value: metric ? formatSiteAnalyticsMetricValue(id, metric.value) : "—",
      change: metric ? formatSiteAnalyticsTrend(metric) : "—",
      isNegative: metric ? metric.trendPercent < 0 : false,
    };
  });
}

export function buildSiteAnalyticsChartPoints(
  data: SiteAnalyticsOverviewResponse | undefined,
  period: AnalyticsPeriodKey,
): SiteAnalyticsChartPoint[] {
  return (data?.points ?? []).map((point) => ({
    label: formatSiteAnalyticsPointLabel(point.time, period),
    value: point.visits,
    secondaryValue: point.registrations,
  }));
}
