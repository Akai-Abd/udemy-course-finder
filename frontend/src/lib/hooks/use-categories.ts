"use client";

import { useQuery } from "@tanstack/react-query";
import { categoriesApi } from "@/lib/api-client";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list().then((res) => res.data),
    staleTime: 1000 * 60 * 30, // 30 minutes — categories rarely change
  });
}
