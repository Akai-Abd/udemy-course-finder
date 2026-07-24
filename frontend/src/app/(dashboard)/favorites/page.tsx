"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Heart, Trash2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useFavorites, useToggleFavorite } from "@/lib/hooks/use-favorites";
import { CourseCard } from "@/components/courses/course-card";
import { ExportButton } from "@/components/courses/export-button";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { toast } from "sonner";
import type { Course } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";

export default function FavoritesPage() {
  const { data: favorites, isLoading, error, refetch } = useFavorites();
  const { removeFavorite } = useToggleFavorite();
  const [sortBy, setSortBy] = useState("newest");
  const [hideExpired, setHideExpired] = useState(false);

  const handleRemoveFavorite = useCallback(
    (courseId: string) => {
      removeFavorite.mutate(courseId, {
        onSuccess: () => toast.success("Removed from favorites"),
      });
    },
    [removeFavorite]
  );

  const handleRemoveAllExpired = useCallback(() => {
    const expired = favorites?.filter(
      (f) => f.course && !f.course.isActive
    );
    if (!expired?.length) return;
    expired.forEach((f) => removeFavorite.mutate(f.courseId));
    toast.success(`Removed ${expired.length} expired course(s) from favorites`);
  }, [favorites, removeFavorite]);

  const handleGetCourse = useCallback((course: Course) => {
    window.open(course.couponUrl, "_blank", "noopener,noreferrer");
  }, []);

  const processedFavorites = useMemo(() => {
    if (!favorites) return [];

    let items = [...favorites].filter((f) => f.course);

    // Filter expired
    if (hideExpired) {
      items = items.filter((f) => f.course!.isActive);
    }

    // Sort
    switch (sortBy) {
      case "rating":
        items.sort(
          (a, b) => (b.course?.rating ?? 0) - (a.course?.rating ?? 0)
        );
        break;
      case "alphabetical":
        items.sort((a, b) =>
          (a.course?.title ?? "").localeCompare(b.course?.title ?? "")
        );
        break;
      case "newest":
      default:
        items.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
    }

    return items;
  }, [favorites, sortBy, hideExpired]);

  const activeCount =
    favorites?.filter((f) => f.course?.isActive).length ?? 0;
  const expiredCount =
    favorites?.filter((f) => f.course && !f.course.isActive).length ?? 0;
  const totalCount = favorites?.length ?? 0;

  if (isLoading) return <LoadingState variant="card-grid" />;
  if (error) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Favorites</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge variant="outline" className="text-[10px] font-bold border-border/40 text-muted-foreground/90 bg-muted/20">
              {activeCount} Active
            </Badge>
            <Badge variant="outline" className="text-[10px] font-bold border-border/40 text-muted-foreground/90 bg-muted/20">
              {totalCount} Total Saved
            </Badge>
            {expiredCount > 0 && (
              <Badge variant="destructive" className="text-[10px] font-extrabold shadow-sm border-0 bg-red-600/90 text-white">
                {expiredCount} Expired
              </Badge>
            )}
          </div>
        </div>

        {expiredCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRemoveAllExpired}
            className="gap-1.5 text-xs font-bold text-destructive border-destructive/30 hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive h-9 rounded-xl"
          >
            <Trash2 className="h-4 w-4" />
            Remove Expired ({expiredCount})
          </Button>
        )}
      </div>

      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-card/45 border border-border/30 p-4 rounded-2xl backdrop-blur-sm shadow-sm">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48 h-9.5 bg-background/60 border-border/40 rounded-xl text-xs font-semibold">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground/60" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border/45 rounded-xl">
              <SelectItem value="newest" className="font-semibold text-xs py-2">Newest Favorited</SelectItem>
              <SelectItem value="rating" className="font-semibold text-xs py-2">Course Rating</SelectItem>
              <SelectItem value="alphabetical" className="font-semibold text-xs py-2">Alphabetical (A-Z)</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center space-x-2 bg-background/50 border border-border/30 rounded-xl px-3.5 py-1.5 shadow-sm h-9.5">
            <Switch
              id="hide-expired"
              checked={hideExpired}
              onCheckedChange={setHideExpired}
              className="scale-90"
            />
            <Label htmlFor="hide-expired" className="text-xs font-semibold text-muted-foreground/90 cursor-pointer select-none">
              Hide expired courses
            </Label>
          </div>

          <ExportButton type="favorites" />
        </div>
      )}

      {!processedFavorites.length ? (
        <EmptyState
          icon={Heart}
          title={hideExpired ? "No active favorites" : "No favorites yet"}
          description={
            hideExpired
              ? "All your favorites have expired. Toggle the filter to see them."
              : "Browse courses and click the heart icon to save them here."
          }
          action={
            <Button variant="gradient" asChild>
              <Link href="/courses">Browse Courses</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {processedFavorites.map((fav) => (
            <CourseCard
              key={fav.id}
              course={fav.course!}
              isFavorited
              onToggleFavorite={handleRemoveFavorite}
              onGetCourse={handleGetCourse}
            />
          ))}
        </div>
      )}
    </div>
  );
}
