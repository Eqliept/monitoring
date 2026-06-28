import { topUpStatusLabels } from "../constants";
import type { RecentTopUp } from "../types";

const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
  style: "currency",
  currency: "RUB",
});

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function getTopUpAmount(topUp: RecentTopUp): number {
  return topUp.creditedAmountRub > 0 ? topUp.creditedAmountRub : topUp.amountRub;
}

export function formatTopUpAmount(topUp: RecentTopUp): string {
  return `+ ${moneyFormatter.format(getTopUpAmount(topUp))}`;
}

export function formatTopUpTime(topUp: RecentTopUp): string {
  return dateTimeFormatter.format(new Date(topUp.paidAt ?? topUp.createdAt));
}

export function getTopUpStatusLabel(topUp: RecentTopUp): string {
  return topUpStatusLabels[topUp.status];
}
