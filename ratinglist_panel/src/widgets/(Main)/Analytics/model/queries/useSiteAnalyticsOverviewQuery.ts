import { useQuery } from "@tanstack/react-query";

import type { AnalyticsPeriodKey } from "../../../../../entities/SiteAnalytics";
import { loadSiteAnalyticsOverview } from "../api/siteAnalyticsApi";

export function useSiteAnalyticsOverviewQuery(period: AnalyticsPeriodKey) {
  return useQuery({
    queryKey: ["site-analytics-overview", period],
    queryFn: () => loadSiteAnalyticsOverview(period),
    staleTime: 30_000,
  });
}
