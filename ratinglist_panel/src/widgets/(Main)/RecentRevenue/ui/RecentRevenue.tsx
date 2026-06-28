import { ArrowDownLeft, ChevronRight } from "lucide-react";

import {
  formatTopUpAmount,
  formatTopUpTime,
  getTopUpStatusLabel,
} from "../../../../entities/TopUp";
import { useRecentTopUpsQuery } from "../model";

export const RecentRevenue = () => {
  const { data, error, isLoading } = useRecentTopUpsQuery(6);
  const topUps = data?.topUps ?? [];

  return (
    <section
      aria-labelledby="recent-revenue-title"
      className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
    >
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-action">
            Транзакции
          </p>
          <h2
            id="recent-revenue-title"
            className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-xl"
          >
            Последние пополнения
          </h2>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary-muted"
        >
          Все операции
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>

      <div className="divide-y divide-border">
        {isLoading && (
          <div className="px-5 py-8 text-sm font-semibold text-muted-foreground sm:px-6">
            Загружаем пополнения...
          </div>
        )}

        {error && (
          <div className="px-5 py-8 text-sm font-semibold text-red-600 sm:px-6">
            {error instanceof Error ? error.message : "Не удалось загрузить пополнения"}
          </div>
        )}

        {!isLoading && !error && topUps.length === 0 && (
          <div className="px-5 py-8 text-sm font-semibold text-muted-foreground sm:px-6">
            Пополнений пока нет.
          </div>
        )}

        {topUps.map((item) => (
          <article
            key={item.id}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-muted/70 sm:gap-4 sm:px-6"
          >
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-action-muted text-action">
              <ArrowDownLeft aria-hidden="true" className="size-5" />
            </span>

            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-sm font-bold text-foreground">
                  {item.userName}
                </p>
                <span className="hidden rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline">
                  {getTopUpStatusLabel(item)}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {item.providerInvoiceId ?? item.id} · {formatTopUpTime(item)}
              </p>
            </div>

            <p className="whitespace-nowrap text-sm font-black text-action">
              {formatTopUpAmount(item)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
};
