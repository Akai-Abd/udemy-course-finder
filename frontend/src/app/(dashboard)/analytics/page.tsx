"use client";

import { useState, useMemo } from "react";
import {
  BarChart3,
  BookOpen,
  Globe,
  TrendingUp,
  CheckCircle2,
  PieChart,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalyticsOverview, useAnalyticsTimeSeries } from "@/lib/hooks/use-analytics";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { TimeSeriesChart } from "@/components/analytics/time-series-chart";
import { DateRangeSelector } from "@/components/analytics/date-range-selector";

const PROVIDER_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#ef4444", "#f97316", "#eab308",
];

export default function AnalyticsPage() {
  const { data: analytics, isLoading, error, refetch } = useAnalyticsOverview();
  const [timeRange, setTimeRange] = useState(30);
  const { data: timeSeries, isLoading: tsLoading } = useAnalyticsTimeSeries(timeRange);

  // Build provider stacked data for the chart
  const providerChartData = useMemo(() => {
    if (!timeSeries?.coursesByProviderPerDay?.length) return { data: [], keys: [] };

    const providerNames = [...new Set(timeSeries.coursesByProviderPerDay.map((d) => d.provider))];
    const dateMap = new Map<string, Record<string, number>>();

    for (const entry of timeSeries.coursesByProviderPerDay) {
      if (!dateMap.has(entry.date)) {
        dateMap.set(entry.date, { date: entry.date as unknown as number });
      }
      const row = dateMap.get(entry.date)!;
      row[entry.provider] = entry.count;
    }

    return {
      data: Array.from(dateMap.values()),
      keys: providerNames.map((name, i) => ({
        key: name,
        color: PROVIDER_COLORS[i % PROVIDER_COLORS.length],
        name,
      })),
    };
  }, [timeSeries]);

  if (isLoading) return <LoadingState message="Loading analytics..." />;
  if (error) return <ErrorState onRetry={() => refetch()} />;

  const overviewCards = [
    {
      title: "Total Courses",
      value: analytics?.totalCourses ?? 0,
      icon: BookOpen,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Total Providers",
      value: analytics?.totalProviders ?? 0,
      icon: Globe,
      color: "text-violet-500",
      bgColor: "bg-violet-500/10",
    },
    {
      title: "Active Sources",
      value: analytics?.activeSources ?? 0,
      icon: TrendingUp,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Scraping Runs",
      value: analytics?.totalScrapingRuns ?? 0,
      icon: BarChart3,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      title: "Success Rate",
      value: `${(analytics?.successRate ?? 0).toFixed(1)}%`,
      icon: CheckCircle2,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Analytics Metrics</h1>
        <p className="text-muted-foreground mt-1 text-sm font-medium">
          Scraping statistics and platform discovery yields trends.
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 select-none">
        {overviewCards.map((card) => (
          <Card key={card.title} className="group relative overflow-hidden bg-card/60 backdrop-blur-sm border border-border/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-card/85">
            <CardContent className="p-5">
              <div className="flex items-center gap-3.5 relative z-10">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-105 shadow-sm ${card.bgColor}`}>
                  <card.icon className={`h-5 w-5 transition-transform duration-300 group-hover:scale-110 ${card.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-black tracking-tight text-foreground leading-none">{card.value}</p>
                  <p className="text-[11px] text-muted-foreground font-semibold mt-1">{card.title}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Time-Series Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 select-none">
            <Activity className="h-5 w-5 text-indigo-500" />
            <h2 className="text-lg font-bold text-foreground">Discovery Trends</h2>
          </div>
          <DateRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>

        {tsLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-[340px] rounded-2xl border border-border/40 bg-card/45 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Courses Added Over Time */}
            {timeSeries?.coursesPerDay?.length ? (
              <TimeSeriesChart
                title="Courses Added Over Time"
                data={timeSeries.coursesPerDay}
                type="area"
                dataKeys={[{ key: "count", color: "#6366f1", name: "Courses" }]}
              />
            ) : (
              <div className="flex items-center justify-center h-[340px] rounded-2xl border border-border/40 bg-card/45">
                <p className="text-sm text-muted-foreground font-medium">No course data for this period</p>
              </div>
            )}

            {/* Scraping Success vs Failure */}
            {timeSeries?.scrapingRunsPerDay?.length ? (
              <TimeSeriesChart
                title="Scraping Runs (Success vs Failure)"
                data={timeSeries.scrapingRunsPerDay}
                type="bar"
                stacked
                dataKeys={[
                  { key: "success", color: "#10b981", name: "Success" },
                  { key: "failed", color: "#f43f5e", name: "Failed" },
                ]}
              />
            ) : (
              <div className="flex items-center justify-center h-[340px] rounded-2xl border border-border/40 bg-card/45">
                <p className="text-sm text-muted-foreground font-medium">No scraping data for this period</p>
              </div>
            )}
          </div>
        )}

        {/* Provider Yield Over Time — Full Width */}
        {!tsLoading && providerChartData.data.length > 0 && (
          <TimeSeriesChart
            title="Provider Yield Over Time"
            data={providerChartData.data}
            type="area"
            stacked
            dataKeys={providerChartData.keys}
            height={350}
          />
        )}
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 select-none">
        {/* By Category */}
        <Card className="rounded-2xl border-border/40 bg-card/45 backdrop-blur-sm shadow-sm hover:border-violet-500/10 transition-colors duration-300">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground/90">
              <PieChart className="h-4.5 w-4.5 text-violet-500" />
              Courses by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics?.coursesByCategory?.length ? (
              <div className="space-y-4">
                {analytics.coursesByCategory.map((item) => {
                  const maxCount = Math.max(
                    ...analytics.coursesByCategory.map((c) => c.count)
                  );
                  const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;

                  return (
                    <div key={item.category} className="space-y-1.5 group/progress">
                      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground/90">
                        <span className="group-hover/progress:text-foreground transition-colors">{item.category}</span>
                        <span className="font-bold tabular-nums text-foreground">{item.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-background border border-border/20 overflow-hidden">
                        <div
                          className="h-full rounded-full gradient-primary transition-all duration-500 shadow-sm"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-6 text-center font-medium">No category breakdown data available yet.</p>
            )}
          </CardContent>
        </Card>

        {/* By Provider */}
        <Card className="rounded-2xl border-border/40 bg-card/45 backdrop-blur-sm shadow-sm hover:border-blue-500/10 transition-colors duration-300">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground/90">
              <Globe className="h-4.5 w-4.5 text-blue-500" />
              Courses by Provider
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics?.coursesByProvider?.length ? (
              <div className="space-y-4">
                {analytics.coursesByProvider.map((item) => {
                  const maxCount = Math.max(
                    ...analytics.coursesByProvider.map((p) => p.count)
                  );
                  const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;

                  return (
                    <div key={item.provider} className="space-y-1.5 group/progress">
                      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground/90">
                        <span className="group-hover/progress:text-foreground transition-colors">{item.provider}</span>
                        <span className="font-bold tabular-nums text-foreground">{item.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-background border border-border/20 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-500 shadow-sm"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-6 text-center font-medium">No provider breakdown data available yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
