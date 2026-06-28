export type TopUpStatus =
  | "pending"
  | "paid"
  | "partial"
  | "overpaid"
  | "canceled"
  | "failed";

export interface RecentTopUp {
  id: string;
  userId: string;
  userName: string;
  provider: string;
  status: TopUpStatus;
  amountRub: number;
  creditedAmountRub: number;
  providerInvoiceId: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface RecentTopUpsResponse {
  topUps: RecentTopUp[];
}
