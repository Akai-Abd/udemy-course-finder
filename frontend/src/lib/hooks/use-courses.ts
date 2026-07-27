"use client";

import { useQuery } from "@tanstack/react-query";
import { coursesApi } from "@/lib/api-client";

export function useCourses(params?: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: ["courses", params],
    queryFn: () => coursesApi.list(params).then((res) => res.data),
  });
}

export function useSearchCourses(params?: Record<string, string | number | undefined>, semantic = false) {
  return useQuery({
    queryKey: ["courses", "search", { ...params, semantic }],
    queryFn: () => {
      const apiFn = semantic ? coursesApi.semanticSearch : coursesApi.search;
      return apiFn(params).then((res) => res.data);
    },
    enabled: !!params?.query,
  });
}

export function useCourse(id: string) {
  return useQuery({
    queryKey: ["courses", id],
    queryFn: () => coursesApi.getById(id).then((res) => res.data),
    enabled: !!id,
  });
}

export function useCourseStats() {
  return useQuery({
    queryKey: ["courses", "stats"],
    queryFn: () => coursesApi.getStats().then((res) => res.data),
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useRecommendations() {
  return useQuery({
    queryKey: ["courses", "recommendations"],
    queryFn: () => coursesApi.getRecommendations().then((res) => res.data),
    staleTime: 30000,
  });
}

export function useSimilarCourses(id: string, limit = 4) {
  return useQuery({
    queryKey: ["courses", id, "similar", limit],
    queryFn: () => coursesApi.getSimilar(id, limit).then((res) => res.data),
    enabled: !!id,
  });
}
