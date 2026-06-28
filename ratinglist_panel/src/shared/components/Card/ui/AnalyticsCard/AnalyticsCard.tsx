import { useId, type FC } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsCardProps } from "../../types";

const compactNumberFormatter = new Intl.NumberFormat("ru-RU", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const AnalyticsCard: FC<AnalyticsCardProps> = ({
  title,
  description,
  periodLabel,
  data,
  valueLabel = "Посещения",
  secondaryValueLabel = "Регистрации",
  className = "",
}) => {
  const gradientId = useId().replaceAll(":", "");

  return (
    <article
      className={[
        "overflow-hidden rounded-2xl border border-border bg-surface shadow-sm",
        className,
      ].join(" ")}
    >
      <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Аналитика
          </p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-xl">
            {title}
          </h2>
          {description && (
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        <span className="w-fit rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
          {periodLabel}
        </span>
      </div>

      <div className="h-[300px] w-full px-1 pb-4 pt-6 sm:h-[340px] sm:px-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            accessibilityLayer
            data={data}
            margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="4 4"
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickMargin={12}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickFormatter={(value: number) => compactNumberFormatter.format(value)}
              width={48}
            />
            <Tooltip
              cursor={{
                stroke: "var(--input)",
                strokeDasharray: "4 4",
              }}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                boxShadow: "0 12px 30px rgb(0 0 0 / 0.14)",
                color: "var(--foreground)",
                fontSize: "12px",
              }}
              labelStyle={{
                color: "var(--foreground)",
                fontWeight: 700,
                marginBottom: "4px",
              }}
              itemStyle={{ color: "var(--muted-foreground)" }}
              formatter={(value, name) => [
                Number(value).toLocaleString("ru-RU"),
                name,
              ]}
            />
            <Area
              type="monotone"
              dataKey="value"
              name={valueLabel}
              stroke="var(--primary)"
              strokeWidth={3}
              fill={`url(#${gradientId})`}
              activeDot={{
                r: 5,
                fill: "var(--primary)",
                stroke: "var(--surface)",
                strokeWidth: 3,
              }}
            />
            <Line
              type="monotone"
              dataKey="secondaryValue"
              name={secondaryValueLabel}
              stroke="var(--action)"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{
                r: 4,
                fill: "var(--action)",
                stroke: "var(--surface)",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-5 py-4 text-xs font-medium text-muted-foreground sm:px-6">
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-primary" />
          {valueLabel}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-action" />
          {secondaryValueLabel}
        </span>
      </div>
    </article>
  );
};
