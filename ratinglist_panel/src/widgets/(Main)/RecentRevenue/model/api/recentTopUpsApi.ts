import type { RecentTopUpsResponse } from "../../../../../entities/TopUp";

const backendUrl = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3000";
const siteAnalyticsBaseUrl = `${backendUrl}/api/site-analytics`;

async function parseRecentTopUpsResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = "Ошибка загрузки пополнений";

    try {
      const text = await response.clone().text();
      const data = text ? JSON.parse(text) : null;
      message = typeof data?.message === "string" ? data.message : message;
    } catch {
      const text = await response.clone().text();

      if (text) {
        message = text;
      }
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function loadRecentTopUps(limit = 6): Promise<RecentTopUpsResponse> {
  const url = new URL(`${siteAnalyticsBaseUrl}/top-ups/recent`);
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url.toString(), {
    method: "GET",
    credentials: "include",
  });

  return await parseRecentTopUpsResponse<RecentTopUpsResponse>(response);
}
