"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { providersApi } from "@/lib/api-client";

export function useProviders() {
  return useQuery({
    queryKey: ["providers"],
    queryFn: () => providersApi.list().then((res) => res.data),
    refetchInterval: 5000, // Real-time live status updates every 5 seconds
  });
}

export function useUpdateProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { isEnabled?: boolean; timeoutMs?: number } }) =>
      providersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: ["provider-stats"] });
    },
  });
}

export function useTriggerScrape() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (providerId?: string) => providersApi.triggerScrape(providerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useTestProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => providersApi.test(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
  });
}

export function useRetryProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => providersApi.retry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
  });
}

export function useProviderLogs(id: string, page = 1, limit = 20) {
  return useQuery({
    queryKey: ["providers", id, "logs", page],
    queryFn: () => providersApi.getLogs(id, page, limit).then((res) => res.data),
    enabled: !!id,
    refetchInterval: 5000,
  });
}

export function useProviderStats(id: string) {
  return useQuery({
    queryKey: ["providers", id, "stats"],
    queryFn: () => providersApi.getStats(id).then((res) => res.data),
    enabled: !!id,
    refetchInterval: 5000,
  });
}
