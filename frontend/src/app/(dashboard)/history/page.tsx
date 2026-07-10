"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import {
  History as HistoryIcon,
  ExternalLink,
  Eye,
  MousePointer,
  GraduationCap,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useHistory } from "@/lib/hooks/use-history";
import { historyApi } from "@/lib/api-client";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { cn } from "@/lib/utils";

const actionIcons = {
  VIEWED: Eye,
  CLICKED: MousePointer,
  ENROLLED: GraduationCap,
};

const actionLabels = {
  VIEWED: "Viewed",
  CLICKED: "Clicked",
  ENROLLED: "Enrolled",
};

type ActionFilter = "ALL" | "VIEWED" | "CLICKED" | "ENROLLED";

function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  if (date >= today) return "Today";
  if (date >= yesterday) return "Yesterday";
  if (date >= weekAgo) return "This Week";
  return "Older";
}

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<ActionFilter>("ALL");
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const {
    data: historyData,
    isLoading,
    error,
    refetch,
  } = useHistory(page, 50);

  const historyEntries = historyData?.data;

  const filteredEntries = useMemo(() => {
    if (!historyEntries) return [];
    if (actionFilter === "ALL") return historyEntries;
    return historyEntries.filter((e) => e.action === actionFilter);
  }, [historyEntries, actionFilter]);

  // Group by date
  const groupedEntries = useMemo(() => {
    const groups: { label: string; entries: typeof filteredEntries }[] = [];
    const groupMap = new Map<string, typeof filteredEntries>();

    for (const entry of filteredEntries) {
      const group = getDateGroup(entry.createdAt);
      if (!groupMap.has(group)) {
        groupMap.set(group, []);
      }
      groupMap.get(group)!.push(entry);
    }

    // Maintain order: Today, Yesterday, This Week, Older
    const order = ["Today", "Yesterday", "This Week", "Older"];
    for (const label of order) {
      const entries = groupMap.get(label);
      if (entries?.length) {
        groups.push({ label, entries });
      }
    }

    return groups;
  }, [filteredEntries]);

  const emptyMessages: Record<ActionFilter, string> = {
    ALL: "Your activity will appear here as you browse and click on courses.",
    VIEWED: "You haven't viewed any course details yet.",
    CLICKED: 'You haven\'t clicked "Get Course" on any courses yet.',
    ENROLLED: "No enrollment activity recorded yet.",
  };

  if (isLoading) return <LoadingState variant="skeleton" />;
  if (error) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-8 animate-fade-in select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">History Log</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Your course viewing and coupon enrollment activity feed.
          </p>
        </div>

        {historyData?.data?.length ? (
          <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-bold text-destructive border-destructive/30 hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive h-9 rounded-xl shadow-sm"
              >
                <Trash2 className="h-4 w-4" />
                Clear History
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-popover border border-border/40 rounded-2xl shadow-xl">
              <DialogHeader>
                <DialogTitle className="font-bold text-foreground">Clear History</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  This will clear all your browsing history. This action cannot
                  be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setClearDialogOpen(false)}
                  className="rounded-xl font-bold h-9"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    try {
                      const res = await historyApi.clear();
                      toast.success(`Cleared ${res.data.deleted} history entries`);
                      refetch();
                    } catch {
                      toast.error("Failed to clear history");
                    }
                    setClearDialogOpen(false);
                  }}
                  className="rounded-xl font-bold h-9"
                >
                  Clear All
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {/* Action Filter Tabs */}
      <Tabs
        value={actionFilter}
        onValueChange={(v) => setActionFilter(v as ActionFilter)}
        className="w-full select-none"
      >
        <TabsList className="bg-muted/30 border border-border/30 rounded-xl p-1 h-11">
          <TabsTrigger value="ALL" className="rounded-lg font-bold text-xs px-4 h-9">All Actions</TabsTrigger>
          <TabsTrigger value="VIEWED" className="gap-1.5 rounded-lg font-bold text-xs px-4 h-9">
            <Eye className="h-3.5 w-3.5" />
            Viewed Details
          </TabsTrigger>
          <TabsTrigger value="CLICKED" className="gap-1.5 rounded-lg font-bold text-xs px-4 h-9">
            <MousePointer className="h-3.5 w-3.5" />
            Clicked "Get"
          </TabsTrigger>
          <TabsTrigger value="ENROLLED" className="gap-1.5 rounded-lg font-bold text-xs px-4 h-9">
            <GraduationCap className="h-3.5 w-3.5" />
            Enrolled
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredEntries.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="No history found"
          description={emptyMessages[actionFilter]}
          action={
            <Button variant="gradient" asChild>
              <Link href="/courses">Browse Courses</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-8 pt-2">
          {groupedEntries.map((group) => (
            <div key={group.label} className="space-y-4">
              <h3 className="text-xs uppercase font-extrabold tracking-wider text-muted-foreground/80 sticky top-0 bg-background/95 backdrop-blur-sm py-2 z-10">
                {group.label}
              </h3>
              
              <div className="relative pl-6 border-l border-border/40 ml-3.5 space-y-6">
                {group.entries.map((entry) => {
                  const ActionIcon = actionIcons[entry.action];
                  const actionColorMap = {
                    VIEWED: "bg-blue-500/10 text-blue-500 border-blue-500/25",
                    CLICKED: "bg-indigo-500/10 text-indigo-500 border-indigo-500/25",
                    ENROLLED: "bg-emerald-500/10 text-emerald-500 border-emerald-500/25",
                  };
                  const activeColor = actionColorMap[entry.action];

                  return (
                    <div key={entry.id} className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
                      {/* Timeline dot */}
                      <div className={cn(
                        "absolute -left-[35px] top-1 flex h-6.5 w-6.5 items-center justify-center rounded-full border bg-background shadow-sm transition-transform group-hover:scale-110",
                        activeColor
                      )}>
                        <ActionIcon className="h-3.5 w-3.5" />
                      </div>

                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        {/* Course Thumbnail */}
                        <div className="relative h-10 w-16 rounded-lg overflow-hidden bg-muted border border-border/20 shrink-0">
                          {entry.course?.thumbnailUrl ? (
                            <Image
                              src={entry.course.thumbnailUrl}
                              alt=""
                              fill
                              sizes="64px"
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center gradient-primary opacity-50">
                              <span className="text-[10px] font-bold text-white/40">
                                {entry.course?.title?.charAt(0) ?? "?"}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Title and Badge */}
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/courses/${entry.courseId}`}
                            className="text-sm font-bold text-foreground/95 hover:text-primary transition-colors line-clamp-1 leading-snug"
                          >
                            {entry.course?.title ?? entry.courseId}
                          </Link>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-muted-foreground/30 text-[10px] select-none">•</span>
                            <Badge variant="outline" className={cn("text-[9px] font-extrabold uppercase px-1.5 h-4.5 border", activeColor)}>
                              {actionLabels[entry.action]}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Launch course button */}
                      {entry.course?.couponUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          className="h-8.5 text-xs font-semibold gap-1.5 border-border/40 hover:bg-muted self-start sm:self-center rounded-xl"
                        >
                          <a
                            href={entry.course.couponUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <span>Launch Course</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Pagination */}
          {historyData && historyData.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-6 select-none">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-9 px-3 text-xs font-bold rounded-xl border border-border/40 hover:bg-muted disabled:opacity-40"
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground font-bold bg-background/60 border border-border/30 px-3.5 py-1.5 rounded-xl shadow-inner tabular-nums">
                Page {page} of {historyData.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= historyData.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-9 px-3 text-xs font-bold rounded-xl border border-border/40 hover:bg-muted disabled:opacity-40"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
