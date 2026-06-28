import type { TopUpStatus } from "../types";

export const topUpStatusLabels: Record<TopUpStatus, string> = {
  pending: "Ожидает",
  paid: "Оплачено",
  partial: "Частично",
  overpaid: "Переплата",
  canceled: "Отменено",
  failed: "Ошибка",
};
