import { useQuery } from "@tanstack/react-query";

import { loadRecentTopUps } from "../api/recentTopUpsApi";

export function useRecentTopUpsQuery(limit = 6) {
  return useQuery({
    queryKey: ["recent-top-ups", limit],
    queryFn: () => loadRecentTopUps(limit),
    staleTime: 30_000,
  });
}
