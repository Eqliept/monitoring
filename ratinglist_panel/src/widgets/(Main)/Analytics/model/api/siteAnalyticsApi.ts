import type {
  AnalyticsPeriodKey,
  SiteAnalyticsOverviewResponse,
} from "../../../../../entities/SiteAnalytics";

const backendUrl = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3000";
const siteAnalyticsBaseUrl = `${backendUrl}/api/site-analytics`;

async function parseSiteAnalyticsResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = "Ошибка загрузки аналитики";

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

export async function loadSiteAnalyticsOverview(
  period: AnalyticsPeriodKey,
): Promise<SiteAnalyticsOverviewResponse> {
  const url = new URL(`${siteAnalyticsBaseUrl}/overview`);
  url.searchParams.set("period", period);

  const response = await fetch(url.toString(), {
    method: "GET",
    credentials: "include",
  });

  return await parseSiteAnalyticsResponse<SiteAnalyticsOverviewResponse>(response);
}
