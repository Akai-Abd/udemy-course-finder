"use client";

import {
  BookOpen,
  Globe,
  Heart,
  TrendingUp,
  Clock,
  Zap,
  Sparkles,
  AlertTriangle,
  Flame,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useCourseStats, useCourses, useRecommendations } from "@/lib/hooks/use-courses";
import { useProviders } from "@/lib/hooks/use-providers";
import { useFavorites, useToggleFavorite } from "@/lib/hooks/use-favorites";
import { useAnalyticsTimeSeries } from "@/lib/hooks/use-analytics";
import { TimeSeriesChart } from "@/components/analytics/time-series-chart";
import { CourseCard } from "@/components/courses/course-card";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useCourseStats();
  const { data: providers, isLoading: providersLoading } = useProviders();
  const { data: newestData, isLoading: newestLoading } = useCourses({
    page: 1,
    limit: 5,
    sort: "newest",
    expiryStatus: "active",
  });
  const { data: expiringData } = useCourses({
    page: 1,
    limit: 5,
    sort: "expiring",
    expiryStatus: "active",
  });
  const { data: favorites } = useFavorites();
  const { addFavorite, removeFavorite } = useToggleFavorite();
  const { data: recommendations, isLoading: recommendationsLoading } = useRecommendations();
  const { data: timeSeries, isLoading: tsLoading } = useAnalyticsTimeSeries(7);

  const favoriteIds = new Set(favorites?.map((f) => f.courseId) ?? []);

  const handleToggleFavorite = (courseId: string) => {
    if (favoriteIds.has(courseId)) {
      removeFavorite.mutate(courseId);
    } else {
      addFavorite.mutate(courseId);
    }
  };

  if (statsLoading || providersLoading) {
    return <LoadingState message="Loading dashboard..." />;
  }

  if (statsError) {
    return <ErrorState onRetry={() => refetchStats()} />;
  }

  const statCards = [
    {
      title: "Total Courses",
      value: stats?.totalCourses ?? 0,
      icon: BookOpen,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      glowColor: "hover:shadow-blue-500/5 hover:border-blue-500/30",
    },
    {
      title: "Active Courses",
      value: stats?.activeCourses ?? 0,
      icon: TrendingUp,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      glowColor: "hover:shadow-emerald-500/5 hover:border-emerald-500/30",
    },
    {
      title: "Expiring Soon",
      value: stats?.expiringSoon ?? 0,
      icon: Clock,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      glowColor: "hover:shadow-amber-500/5 hover:border-amber-500/30",
    },
    {
      title: "Favorites",
      value: stats?.totalFavorites ?? 0,
      icon: Heart,
      color: "text-rose-500",
      bgColor: "bg-rose-500/10",
      glowColor: "hover:shadow-rose-500/5 hover:border-rose-500/30",
    },
    {
      title: "Active Sources",
      value: stats?.activeSources ?? 0,
      icon: Globe,
      color: "text-violet-500",
      bgColor: "bg-violet-500/10",
      glowColor: "hover:shadow-violet-500/5 hover:border-violet-500/30",
    },
  ];

  const activeProviders = providers?.filter((p) => p.isEnabled) ?? [];
  const recentRuns =
    providers
      ?.filter((p) => p.lastRunAt)
      .sort(
        (a, b) =>
          new Date(b.lastRunAt!).getTime() - new Date(a.lastRunAt!).getTime()
      )
      .slice(0, 5) ?? [];

  const newestCourses = newestData?.data ?? [];
  const expiringCourses = expiringData?.data?.filter((c) => c.expiresAt) ?? [];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent border border-border/40 backdrop-blur-sm shadow-sm select-none">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            Welcome back, Admin 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            Here is what is happening with your course discovery engine today.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center bg-background/60 border border-border/30 px-3.5 py-1.5 rounded-xl shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] font-bold text-foreground/80 tracking-wide uppercase">Scraper System Active</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <Card
            key={stat.title}
            className={cn(
              "group relative overflow-hidden bg-card/60 backdrop-blur-sm border border-border/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-card/80",
              stat.glowColor
            )}
          >
            <CardContent className="p-5">
              <div className="flex items-center gap-3.5 relative z-10">
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-105 shadow-sm",
                    stat.bgColor
                  )}
                >
                  <stat.icon className={cn("h-5 w-5 transition-transform duration-300 group-hover:scale-110", stat.color)} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-black tracking-tight text-foreground leading-none">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground font-semibold mt-1 truncate">{stat.title}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Analytics Trend + Personalized Picks split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sparkline / Course Discover Area Chart (Spans 2 columns on lg screen) */}
        <div className="lg:col-span-2 flex flex-col justify-stretch">
          {tsLoading ? (
            <div className="h-full min-h-[290px] rounded-2xl border border-border/40 bg-card/45 animate-pulse" />
          ) : timeSeries?.coursesPerDay?.length ? (
            <TimeSeriesChart
              title="Discovery Yield (Last 7 Days)"
              data={timeSeries.coursesPerDay}
              type="area"
              height={195}
              dataKeys={[{ key: "count", color: "#6366f1", name: "Discovered Courses" }]}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[290px] rounded-2xl border border-border/40 bg-card/45">
              <Clock className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground font-medium">No discovery stats available yet</p>
            </div>
          )}
        </div>

        {/* Recommended for You Section (Spans 1 column on lg screen) */}
        <Card className="flex flex-col border border-border/40 bg-gradient-to-br from-indigo-500/5 via-transparent to-amber-500/5 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden justify-between p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground/95">
              <Flame className="h-4.5 w-4.5 text-orange-500 fill-orange-500 animate-pulse" />
              Personalized Recommendations
            </h3>
            <Badge variant="success" className="text-[9px] font-extrabold uppercase tracking-wide bg-indigo-500/10 text-indigo-500 border border-indigo-500/10 py-0 px-1.5 h-4.5">
              FOR YOU
            </Badge>
          </div>
          
          <div className="flex-1 flex flex-col justify-center">
            {recommendationsLoading ? (
              <div className="h-44 rounded-xl bg-muted animate-pulse" />
            ) : !recommendations || recommendations.length === 0 ? (
              <div className="text-center py-6">
                <Sparkles className="h-6 w-6 text-indigo-500/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground font-medium leading-relaxed max-w-[200px] mx-auto">
                  Browse catalog & save favorites to receive recommendations!
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {recommendations.slice(0, 2).map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    compact
                    isFavorited={favoriteIds.has(course.id)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Two-column layout: Newest Courses + Expiring Soon */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Newest Courses */}
        <Card className="rounded-2xl border-border/40 bg-card/45 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground/90">
              <Sparkles className="h-4.5 w-4.5 text-violet-500" />
              Newest Additions
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-8 hover:bg-muted/60" asChild>
              <Link href="/courses">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {newestLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-16 rounded-xl bg-muted animate-pulse"
                  />
                ))}
              </div>
            ) : newestCourses.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 font-medium">
                No courses discovered yet. Scraper will fetch shortly.
              </p>
            ) : (
              <div className="space-y-2.5">
                {newestCourses.slice(0, 4).map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    compact
                    isFavorited={favoriteIds.has(course.id)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expiring Soon */}
        <Card className="rounded-2xl border-border/40 bg-card/45 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground/90">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
              Expiring Coupons
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-8 hover:bg-muted/60" asChild>
              <Link href="/courses?sort=expiring">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {expiringCourses.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 font-medium">
                No coupons expiring soon. You are all caught up!
              </p>
            ) : (
              <div className="space-y-2.5">
                {expiringCourses.slice(0, 4).map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    compact
                    isFavorited={favoriteIds.has(course.id)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Two-column layout: Sources + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Sources */}
        <Card className="rounded-2xl border-border/40 bg-card/45 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground/90">
              <Zap className="h-4.5 w-4.5 text-amber-500" />
              Active Coupon Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeProviders.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 font-medium">
                  No active coupon sources configured.
                </p>
              ) : (
                activeProviders.map((provider) => (
                  <div
                    key={provider.id}
                    className="flex items-center justify-between rounded-xl border border-border/30 bg-muted/10 p-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          provider.lastStatus === "RUNNING"
                            ? "bg-blue-500 animate-pulse"
                            : "bg-emerald-500"
                        )}
                      />
                      <span className="text-sm font-semibold text-foreground/90">
                        {provider.name}
                      </span>
                    </div>
                    <Badge
                      variant={
                        provider.lastStatus === "SUCCESS"
                          ? "success"
                          : provider.lastStatus === "FAILED"
                          ? "destructive"
                          : provider.lastStatus === "RUNNING"
                          ? "info"
                          : "secondary"
                      }
                      className="text-[10px] font-extrabold"
                    >
                      {provider.lastStatus}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="rounded-2xl border-border/40 bg-card/45 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground/90">
              <Clock className="h-4.5 w-4.5 text-blue-500" />
              Recent Scraper Feeds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentRuns.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 font-medium">
                  No scraping activity logged yet.
                </p>
              ) : (
                recentRuns.map((provider) => (
                  <div
                    key={provider.id}
                    className="flex items-center justify-between rounded-xl border border-border/30 bg-muted/10 p-3 transition-colors hover:bg-muted/30"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground/90">{provider.name}</p>
                      <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                        {new Date(provider.lastRunAt!).toLocaleString()}
                      </p>
                    </div>
                    <Badge
                      variant={
                        provider.lastStatus === "SUCCESS"
                          ? "success"
                          : provider.lastStatus === "FAILED"
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-[10px] font-extrabold"
                    >
                      {provider.lastStatus}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
