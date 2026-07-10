"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { historyApi } from "@/lib/api-client";

export function useHistory(page = 1, limit = 20) {
  return useQuery({
    queryKey: ["history", page, limit],
    queryFn: () => historyApi.list(page, limit).then((res) => res.data),
  });
}

export function useRecordHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ courseId, action }: { courseId: string; action: "VIEWED" | "CLICKED" | "ENROLLED" }) =>
      historyApi.record(courseId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["history"] });
    },
  });
}
