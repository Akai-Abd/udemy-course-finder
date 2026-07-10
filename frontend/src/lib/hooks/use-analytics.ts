"use client";

import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api-client";

export function useAnalytics() {
  return useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: () => analyticsApi.getOverview().then((res) => res.data),
    staleTime: 5 * 60 * 1000,
  });
}

// Backward-compatible alias
export const useAnalyticsOverview = useAnalytics;

export function useAnalyticsTimeSeries(days: number = 30) {
  return useQuery({
    queryKey: ["analytics", "time-series", days],
    queryFn: () => analyticsApi.getTimeSeries(days).then((res) => res.data),
    staleTime: 5 * 60 * 1000,
  });
}
