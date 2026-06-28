import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Eye,
  UserPlus,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildSiteAnalyticsChartPoints,
  buildSiteAnalyticsMetrics,
  buildSiteAnalyticsPeriodLabel,
  siteAnalyticsPeriodOptions,
  type AnalyticsPeriodKey,
  type SiteAnalyticsMetricId,
} from "../../../../entities/SiteAnalytics";
import { AnalyticsCard } from "../../../../shared/components/Card";
import { Grid } from "../../../../shared/components/Grid";
import { useSiteAnalyticsOverviewQuery } from "../model";

interface MetricPresentation {
  icon: LucideIcon;
  accentClass: string;
}

const metricPresentation: Record<SiteAnalyticsMetricId, MetricPresentation> = {
  visits: {
    icon: Eye,
    accentClass: "bg-primary-muted text-primary",
  },
  averageTimeSeconds: {
    icon: Clock3,
    accentClass: "bg-action-muted text-action",
  },
  registrations: {
    icon: UserPlus,
    accentClass: "bg-primary-muted text-primary",
  },
  revenueRub: {
    icon: WalletCards,
    accentClass: "bg-action-muted text-action",
  },
};

export const Analytics = () => {
  const [period, setPeriod] = useState<AnalyticsPeriodKey>("30d");
  const { data, error, isLoading } = useSiteAnalyticsOverviewQuery(period);

  const metrics = useMemo(() => buildSiteAnalyticsMetrics(data), [data]);
  const chartData = useMemo(
    () => buildSiteAnalyticsChartPoints(data, period),
    [data, period],
  );

  const periodLabel = buildSiteAnalyticsPeriodLabel(data);

  return (
    <section aria-labelledby="analytics-title" className="space-y-5">
      <div>
        <h1
          id="analytics-title"
          className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl"
        >
          Обзор панели
        </h1>

        <label className="relative mt-4 block w-full sm:w-56">
          <span className="sr-only">Период аналитики</span>
          <CalendarDays
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary"
          />
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as AnalyticsPeriodKey)}
            className="h-10 w-full cursor-pointer appearance-none rounded-lg border border-border bg-surface pl-9 pr-8 text-xs font-bold text-foreground shadow-sm outline-none transition-colors hover:border-input focus:border-primary focus:ring-4 focus:ring-primary-muted"
          >
            {siteAnalyticsPeriodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground"
          >
            ▼
          </span>
        </label>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error instanceof Error ? error.message : "Не удалось загрузить аналитику"}
        </div>
      )}

      <Grid variant="dashboard" gap="medium">
        {metrics.map((metric) => {
          const presentation = metricPresentation[metric.id];
          const Icon = presentation.icon;
          const TrendIcon = metric.isNegative ? ArrowDownRight : ArrowUpRight;

          return (
            <article
              key={metric.id}
              className="rounded-2xl border border-border bg-surface p-5 shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-4">
                <span
                  className={[
                    "inline-flex size-10 items-center justify-center rounded-xl",
                    presentation.accentClass,
                  ].join(" ")}
                >
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span
                  className={[
                    "inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-bold",
                    metric.isNegative
                      ? "bg-red-50 text-red-600"
                      : "bg-action-muted text-action",
                  ].join(" ")}
                >
                  {metric.change}
                  <TrendIcon aria-hidden="true" className="size-3.5" />
                </span>
              </div>

              <p className="mt-5 text-sm font-medium text-muted-foreground">
                {metric.label}
              </p>
              <p className="mt-1 text-xl font-black tracking-tight text-foreground">
                {isLoading ? "Загрузка..." : metric.value}
              </p>
            </article>
          );
        })}
      </Grid>

      <AnalyticsCard
        title="Активность пользователей"
        description="Динамика посещений и регистраций за выбранный период."
        periodLabel={periodLabel}
        data={chartData}
      />
    </section>
  );
};
