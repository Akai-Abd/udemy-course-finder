"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { favoritesApi } from "@/lib/api-client";

export function useFavorites() {
  return useQuery({
    queryKey: ["favorites"],
    queryFn: () => favoritesApi.list().then((res) => res.data),
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  const addFavorite = useMutation({
    mutationFn: (courseId: string) => favoritesApi.add(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["courses", "stats"] });
    },
  });

  const removeFavorite = useMutation({
    mutationFn: (courseId: string) => favoritesApi.remove(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["courses", "stats"] });
    },
  });

  return { addFavorite, removeFavorite };
}
