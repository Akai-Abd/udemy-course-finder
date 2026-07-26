"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Search, LayoutGrid, List, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCourses, useSearchCourses } from "@/lib/hooks/use-courses";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Suspense } from "react";
import { useFavorites, useToggleFavorite } from "@/lib/hooks/use-favorites";
import { useRecordHistory } from "@/lib/hooks/use-history";
import { useAnalyticsOverview } from "@/lib/hooks/use-analytics";
import { CourseCard } from "@/components/courses/course-card";
import { CourseFilters } from "@/components/courses/course-filters";
import { ExportButton } from "@/components/courses/export-button";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Pagination } from "@/components/shared/pagination";
import type { Course } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function CoursesContent() {
  const searchParamsHook = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const page = Number(searchParamsHook.get("page")) || 1;
  const [searchInput, setSearchInput] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [providerId, setProviderId] = useState<string | undefined>(undefined);
  const [expiryStatus, setExpiryStatus] = useState("active");
  const [language, setLanguage] = useState("English");
  const [isSemantic, setIsSemantic] = useState(false);

  const setPage = useCallback(
    (pageOrFn: number | ((prev: number) => number)) => {
      const current = Number(new URLSearchParams(window.location.search).get("page")) || 1;
      const newPage =
        typeof pageOrFn === "function" ? pageOrFn(current) : pageOrFn;
      const params = new URLSearchParams(window.location.search);
      if (newPage > 1) {
        params.set("page", newPage.toString());
      } else {
        params.delete("page");
      }
      const newUrl = params.toString()
        ? `${pathname}?${params.toString()}`
        : pathname;
      router.push(newUrl, { scroll: false });
    },
    [pathname, router]
  );

  const debouncedSearch = useDebounce(searchInput, 300);
  const isSearching = debouncedSearch.length > 0;

  const courseParams = useMemo(
    () =>
      !isSearching
        ? {
            page,
            limit: 12,
            sort: sortBy,
            categoryId,
            providerId,
            expiryStatus,
            language,
          }
        : undefined,
    [isSearching, page, sortBy, categoryId, providerId, expiryStatus, language]
  );

  const searchParams = useMemo(
    () =>
      isSearching
        ? {
            q: debouncedSearch,
            page,
            limit: 12,
            categoryId,
            providerId,
            expiryStatus,
            language,
          }
        : undefined,
    [isSearching, debouncedSearch, page, categoryId, providerId, expiryStatus, language]
  );

  const {
    data: coursesData,
    isLoading,
    error,
    refetch,
  } = useCourses(courseParams);
  const { data: searchData, isLoading: searchLoading } =
    useSearchCourses(searchParams, isSemantic);
  const { data: analytics } = useAnalyticsOverview();
  const { data: favorites } = useFavorites();
  const { addFavorite, removeFavorite } = useToggleFavorite();
  const recordHistory = useRecordHistory();

  const displayData = isSearching ? searchData : coursesData;
  const loading = isSearching ? searchLoading : isLoading;

  const totalInDb = analytics?.totalCourses;
  const nonEnglishCount =
    totalInDb && displayData?.total !== undefined && expiryStatus === "active" && !isSearching
      ? totalInDb - displayData.total
      : null;

  const favoriteIds = useMemo(
    () => new Set(favorites?.map((f) => f.courseId) ?? []),
    [favorites]
  );

  const handleToggleFavorite = useCallback(
    (courseId: string) => {
      if (favoriteIds.has(courseId)) {
        removeFavorite.mutate(courseId, {
          onSuccess: () => toast.success("Removed from favorites"),
        });
      } else {
        addFavorite.mutate(courseId, {
          onSuccess: () => toast.success("Added to favorites"),
        });
      }
    },
    [favoriteIds, addFavorite, removeFavorite]
  );

  const handleGetCourse = useCallback(
    (course: Course) => {
      recordHistory.mutate({ courseId: course.id, action: "CLICKED" });
      window.open(course.couponUrl, "_blank", "noopener,noreferrer");
    },
    [recordHistory]
  );

  const resetPage = useCallback(() => setPage(1), [setPage]);

  const handleClearFilters = useCallback(() => {
    setCategoryId(undefined);
    setProviderId(undefined);
    setExpiryStatus("active");
    setLanguage("English");
    setPage(1);
  }, [setPage]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Courses Catalog</h1>
        <p className="text-muted-foreground mt-1 text-sm font-medium">
          Browse, query, and save free active coupons from Udemy.
        </p>
      </div>

      {/* Search, Sort, View Toggle controls */}
      <div className="flex flex-col md:flex-row gap-4 bg-card/45 border border-border/30 p-4 rounded-2xl backdrop-blur-sm shadow-sm">
        <div className="relative flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <Input
              placeholder={isSemantic ? "Describe what you want to learn (e.g. build scrapers in python)..." : "Search courses by keywords, instructor, or technology..."}
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setPage(1);
              }}
              className="pl-9.5 h-10 bg-background/60 border-border/40 rounded-xl focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 text-sm font-semibold"
            />
          </div>
          <Button
            type="button"
            variant={isSemantic ? "gradient" : "outline"}
            onClick={() => {
              setIsSemantic(!isSemantic);
              setPage(1);
            }}
            className={cn(
              "h-10 px-4.5 rounded-xl text-xs font-bold gap-2 shadow-sm transition-all select-none shrink-0",
              isSemantic ? "shadow-primary/10" : "border-border/40 hover:bg-muted/60"
            )}
          >
            <Sparkles className={cn("h-4 w-4", isSemantic ? "text-primary-foreground fill-primary-foreground animate-pulse" : "text-indigo-500")} />
            <span>AI Semantic Search</span>
          </Button>
        </div>
        <div className="flex items-center gap-3.5 flex-wrap sm:flex-nowrap">
          <Select
            value={sortBy}
            onValueChange={(v) => {
              setSortBy(v);
              resetPage();
            }}
          >
            <SelectTrigger className="w-48 h-10 bg-background/60 border-border/40 rounded-xl text-sm font-semibold">
              <SelectValue placeholder="Sort Catalog" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border/40 rounded-xl">
              <SelectItem value="newest" className="font-semibold text-xs py-2">Newest Discovered</SelectItem>
              <SelectItem value="rating" className="font-semibold text-xs py-2">Highest Rated</SelectItem>
              <SelectItem value="expiring" className="font-semibold text-xs py-2">Expiring Soon</SelectItem>
              <SelectItem value="title" className="font-semibold text-xs py-2">Alphabetical (A-Z)</SelectItem>
            </SelectContent>
          </Select>

          {/* View Toggle */}
          <div className="flex items-center rounded-xl bg-background/60 border border-border/30 p-1 shadow-sm h-10 select-none">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-3 rounded-lg text-xs font-bold gap-1 transition-all",
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Grid</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-3 rounded-lg text-xs font-bold gap-1 transition-all",
                viewMode === "list"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setViewMode("list")}
            >
              <List className="h-3.5 w-3.5" />
              <span>List</span>
            </Button>
          </div>

          <ExportButton type="all" />
        </div>
      </div>

      {/* Filters */}
      <CourseFilters
        categoryId={categoryId}
        providerId={providerId}
        expiryStatus={expiryStatus}
        language={language}
        onCategoryChange={(id) => {
          setCategoryId(id);
          resetPage();
        }}
        onProviderChange={(id) => {
          setProviderId(id);
          resetPage();
        }}
        onExpiryChange={(status) => {
          setExpiryStatus(status);
          resetPage();
        }}
        onLanguageChange={(lang) => {
          setLanguage(lang);
          resetPage();
        }}
        onClearAll={handleClearFilters}
      />

      {/* Result count with clear total explanation */}
      {displayData && !loading && (
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground font-semibold">
          <span>
            Showing {displayData.data.length} of {displayData.total}{" "}
            {language === "English"
              ? "English courses"
              : language === "all"
              ? "courses (All Languages)"
              : "Non-English courses"}
          </span>
          {language === "English" &&
            nonEnglishCount !== null &&
            nonEnglishCount > 0 && (
              <span className="text-[11px] font-extrabold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                {nonEnglishCount} Non-English courses hidden ({totalInDb} total in database)
              </span>
            )}
          {isSearching && (
            <span>
              {" "}
              for &ldquo;<span className="font-bold text-foreground">{debouncedSearch}</span>&rdquo;
            </span>
          )}
        </div>
      )}

      {/* Course Grid/List */}
      {loading ? (
        <LoadingState variant="card-grid" />
      ) : error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !displayData?.data?.length ? (
        <EmptyState
          icon={Search}
          title="No courses found"
          description={
            isSearching
              ? "Try adjusting your search query or filters"
              : "No courses available yet. Wait for the scraper to discover courses."
          }
        />
      ) : (
        <>
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {displayData.data.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  isFavorited={favoriteIds.has(course.id)}
                  onToggleFavorite={handleToggleFavorite}
                  onGetCourse={handleGetCourse}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {displayData.data.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  compact
                  isFavorited={favoriteIds.has(course.id)}
                  onToggleFavorite={handleToggleFavorite}
                  onGetCourse={handleGetCourse}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {displayData.totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={displayData.totalPages}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}

export default function CoursesPage() {
  return (
    <Suspense fallback={<LoadingState variant="card-grid" />}>
      <CoursesContent />
    </Suspense>
  );
}
