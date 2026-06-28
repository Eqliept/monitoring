export interface AnalyticsPoint {
  label: string;
  value: number;
  secondaryValue: number;
}

export interface AnalyticsCardProps {
  title: string;
  description?: string;
  periodLabel: string;
  data: AnalyticsPoint[];
  valueLabel?: string;
  secondaryValueLabel?: string;
  className?: string;
}
