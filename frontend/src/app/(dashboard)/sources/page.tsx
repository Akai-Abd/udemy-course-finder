"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Globe,
  Play,
  TestTube,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Settings2,
  FileText,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useProviders,
  useUpdateProvider,
  useTriggerScrape,
  useTestProvider,
  useRetryProvider,
  useProviderLogs,
  useProviderStats,
} from "@/lib/hooks/use-providers";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import type { Provider } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Timeout Editor ───
function TimeoutEditor({
  provider,
  onSave,
}: {
  provider: Provider;
  onSave: (timeoutMs: number) => void;
}) {
  const [value, setValue] = useState(String(provider.timeoutMs / 1000));
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div
        className="flex items-center gap-2 cursor-pointer group"
        onClick={() => setEditing(true)}
      >
        <p className="text-xs text-muted-foreground font-semibold">Timeout</p>
        <p className="text-sm font-bold group-hover:text-primary transition-colors">
          {provider.timeoutMs / 1000}s
        </p>
        <Settings2 className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-background/30 border border-border/30 px-3 py-1.5 rounded-xl animate-fade-in">
      <Label className="text-xs text-muted-foreground font-semibold shrink-0">Timeout</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-7 w-16 text-xs text-center border-border/40 rounded-lg"
        min={5}
        max={300}
      />
      <span className="text-xs text-muted-foreground font-semibold">sec</span>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs px-2 font-bold hover:bg-emerald-500/10 hover:text-emerald-500"
        onClick={() => {
          const ms = Math.max(5000, Math.min(300000, Number(value) * 1000));
          onSave(ms);
          setEditing(false);
        }}
      >
        Save
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs px-2 font-bold hover:bg-destructive/10 hover:text-destructive"
        onClick={() => {
          setValue(String(provider.timeoutMs / 1000));
          setEditing(false);
        }}
      >
        Cancel
      </Button>
    </div>
  );
}

// ─── Log Viewer Dialog ───
function LogViewerDialog({
  provider,
  open,
  onClose,
}: {
  provider: Provider;
  open: boolean;
  onClose: () => void;
}) {
  const [logPage, setLogPage] = useState(1);
  const { data: logsData, isLoading } = useProviderLogs(
    provider.id,
    logPage,
    20
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-popover/95 backdrop-blur-md border border-border/40 rounded-2xl shadow-2xl">
        <DialogHeader className="pb-3 border-b border-border/35">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <FileText className="h-5 w-5 text-indigo-500" />
            Logs — {provider.name}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12"><LoadingState variant="skeleton" /></div>
        ) : !logsData?.data?.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center font-medium">
            No logs available for this provider.
          </p>
        ) : (
          <div className="space-y-4 pt-3">
            <div className="rounded-xl border border-border/40 overflow-hidden shadow-sm bg-card/40">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-b border-border/35">
                    <TableHead className="w-12 font-bold text-xs uppercase text-muted-foreground/80">Status</TableHead>
                    <TableHead className="font-bold text-xs uppercase text-muted-foreground/80">Started</TableHead>
                    <TableHead className="font-bold text-xs uppercase text-muted-foreground/80">Duration</TableHead>
                    <TableHead className="font-bold text-xs uppercase text-muted-foreground/80">Found</TableHead>
                    <TableHead className="font-bold text-xs uppercase text-muted-foreground/80">Accepted</TableHead>
                    <TableHead className="font-bold text-xs uppercase text-muted-foreground/80">Rejected</TableHead>
                    <TableHead className="font-bold text-xs uppercase text-muted-foreground/80">Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsData.data.map((log) => {
                    const duration =
                      log.finishedAt && log.startedAt
                        ? Math.round(
                            (new Date(log.finishedAt).getTime() -
                              new Date(log.startedAt).getTime()) /
                              1000
                          )
                        : null;
                    return (
                      <TableRow key={log.id} className="border-b border-border/30 hover:bg-muted/20">
                        <TableCell>
                          {log.status === "SUCCESS" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : log.status === "FAILED" ? (
                            <XCircle className="h-4 w-4 text-destructive" />
                          ) : (
                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-semibold tabular-nums">
                          {new Date(log.startedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs font-semibold tabular-nums text-muted-foreground">
                          {duration !== null ? `${duration}s` : "—"}
                        </TableCell>
                        <TableCell className="text-xs font-bold tabular-nums">
                          {log.coursesFound}
                        </TableCell>
                        <TableCell className="text-xs font-extrabold tabular-nums text-emerald-500 bg-emerald-500/5 px-2">
                          {log.coursesAccepted}
                        </TableCell>
                        <TableCell className="text-xs font-extrabold tabular-nums text-destructive bg-destructive/5 px-2">
                          {log.coursesRejected}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate font-medium">
                          {log.message ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {logsData.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2 select-none">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={logPage <= 1}
                  onClick={() => setLogPage((p) => p - 1)}
                  className="h-8 text-xs font-semibold border-border/40 hover:bg-muted"
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground font-semibold px-2">
                  Page {logPage} of {logsData.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={logPage >= logsData.totalPages}
                  onClick={() => setLogPage((p) => p + 1)}
                  className="h-8 text-xs font-semibold border-border/40 hover:bg-muted"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Provider Details (expanded) ───
function ProviderDetails({
  provider,
  onTimeoutSave,
  onViewAllLogs,
}: {
  provider: Provider;
  onTimeoutSave: (timeoutMs: number) => void;
  onViewAllLogs: () => void;
}) {
  const { data: stats } = useProviderStats(provider.id);
  const { data: logsData } = useProviderLogs(provider.id, 1, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-3 animate-fade-in">
      {/* Stats */}
      <Card className="border border-border/30 bg-card/30 rounded-xl hover:border-emerald-500/10 transition-all duration-300">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs uppercase tracking-wider font-bold text-muted-foreground/80 flex items-center gap-2">
            <Activity className="h-4 w-4 text-indigo-500" />
            Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Total Scrapes</p>
              <p className="font-extrabold text-base text-foreground mt-0.5 tabular-nums">{stats?.totalRuns ?? 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Success Rate</p>
              <p className="font-extrabold text-base text-foreground mt-0.5 tabular-nums">
                {(stats?.successRate ?? 0).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Courses Found</p>
              <p className="font-extrabold text-base text-foreground mt-0.5 tabular-nums">
                {stats?.totalCoursesFound ?? 0}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Courses Accepted</p>
              <p className="font-extrabold text-base text-emerald-500 mt-0.5 tabular-nums">
                {stats?.totalCoursesAccepted ?? 0}
              </p>
            </div>
          </div>
          <Separator className="border-border/30" />
          <TimeoutEditor provider={provider} onSave={onTimeoutSave} />
        </CardContent>
      </Card>

      {/* Recent Logs */}
      <Card className="border border-border/30 bg-card/30 rounded-xl hover:border-indigo-500/10 transition-all duration-300">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-xs uppercase tracking-wider font-bold text-muted-foreground/80 flex items-center gap-2">
            <Clock className="h-4 w-4 text-indigo-500" />
            Recent Run Log
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2 font-bold text-indigo-500 hover:text-indigo-600"
            onClick={onViewAllLogs}
          >
            View History
          </Button>
        </CardHeader>
        <CardContent>
          {!logsData?.data?.length ? (
            <p className="text-xs text-muted-foreground font-medium text-center py-6">No scraping history logged yet</p>
          ) : (
            <div className="space-y-3">
              {logsData.data.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between text-xs border-b border-border/20 pb-2 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-2">
                    {log.status === "SUCCESS" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : log.status === "FAILED" ? (
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    ) : (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                    )}
                    <span className="text-muted-foreground font-medium tabular-nums">
                      {new Date(log.startedAt).toLocaleString()}
                    </span>
                  </div>
                  <span className="font-semibold tabular-nums text-foreground/80">
                    {log.coursesAccepted} accepted / {log.coursesFound} found
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Sources Page ───
export default function SourcesPage() {
  const { data: providers, isLoading, error, refetch } = useProviders();
  const updateProvider = useUpdateProvider();
  const triggerScrape = useTriggerScrape();
  const testProvider = useTestProvider();
  const retryProvider = useRetryProvider();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logViewerId, setLogViewerId] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleEnabled = useCallback(
    (id: string, checked: boolean) => {
      updateProvider.mutate(
        { id, data: { isEnabled: checked } },
        {
          onSuccess: () =>
            toast.success(`Provider ${checked ? "enabled" : "disabled"}`),
        }
      );
    },
    [updateProvider]
  );

  const handleScrape = useCallback(
    (providerId?: string) => {
      triggerScrape.mutate(providerId, {
        onSuccess: () =>
          toast.success(
            providerId ? "Scrape triggered" : "Scrape All triggered"
          ),
        onError: () => toast.error("Failed to trigger scrape"),
      });
    },
    [triggerScrape]
  );

  const handleTest = useCallback(
    (id: string) => {
      testProvider.mutate(id, {
        onSuccess: () => toast.success("Connectivity test passed"),
        onError: () => toast.error("Connectivity test failed"),
      });
    },
    [testProvider]
  );

  const handleRetry = useCallback(
    (id: string) => {
      retryProvider.mutate(id, {
        onSuccess: () => toast.success("Retry queued"),
        onError: () => toast.error("Failed to retry"),
      });
    },
    [retryProvider]
  );

  const handleTimeoutSave = useCallback(
    (id: string, timeoutMs: number) => {
      updateProvider.mutate(
        { id, data: { timeoutMs } },
        { onSuccess: () => toast.success("Timeout updated") }
      );
    },
    [updateProvider]
  );

  const handleBulkToggle = useCallback(
    (enable: boolean) => {
      providers?.forEach((p) => {
        if (p.isEnabled !== enable) {
          updateProvider.mutate({ id: p.id, data: { isEnabled: enable } });
        }
      });
      toast.success(enable ? "All sources enabled" : "All sources disabled");
    },
    [providers, updateProvider]
  );

  if (isLoading) return <LoadingState variant="skeleton" />;
  if (error) return <ErrorState onRetry={() => refetch()} />;

  // Health summary
  const totalProviders = providers?.length ?? 0;
  const enabledCount = providers?.filter((p) => p.isEnabled).length ?? 0;
  const successCount =
    providers?.filter((p) => p.lastStatus === "SUCCESS").length ?? 0;
  const lastRunProvider = providers
    ?.filter((p) => p.lastRunAt)
    .sort(
      (a, b) =>
        new Date(b.lastRunAt!).getTime() - new Date(a.lastRunAt!).getTime()
    )[0];
  const lastRunAgo = lastRunProvider?.lastRunAt && now
    ? Math.round(
        (now - new Date(lastRunProvider.lastRunAt).getTime()) / 60000
      )
    : null;

  const logViewerProvider = logViewerId
    ? providers?.find((p) => p.id === logViewerId)
    : null;

  return (
    <div className="space-y-8 animate-fade-in select-none">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Scraper Sources</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Manage and schedule your {totalProviders} course aggregator feeds.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkToggle(true)}
            className="gap-1.5 text-xs font-bold border-border/40 hover:bg-accent h-9"
          >
            <ToggleRight className="h-4 w-4 text-emerald-500" />
            Enable All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkToggle(false)}
            className="gap-1.5 text-xs font-bold border-border/40 hover:bg-accent h-9"
          >
            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
            Disable All
          </Button>
          <Button
            variant="gradient"
            onClick={() => handleScrape(undefined)}
            disabled={triggerScrape.isPending}
            className="gap-2 text-xs font-extrabold h-9 shadow-md shadow-primary/10 hover:shadow-primary/20"
          >
            {triggerScrape.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 text-white fill-white" />
            )}
            Scrape All
          </Button>
        </div>
      </div>

      {/* Health Summary Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card/45 backdrop-blur-sm border border-border/30 hover:border-emerald-500/20 hover:shadow-sm transition-all duration-300">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Activity className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Sources</p>
              <p className="text-base font-extrabold text-foreground mt-0.5">
                {enabledCount} <span className="text-xs text-muted-foreground font-medium">/ {totalProviders} online</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/45 backdrop-blur-sm border border-border/30 hover:border-emerald-500/20 hover:shadow-sm transition-all duration-300">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Successful Feeds</p>
              <p className="text-base font-extrabold text-foreground mt-0.5">
                {successCount} <span className="text-xs text-muted-foreground font-medium">healthy</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/45 backdrop-blur-sm border border-border/30 hover:border-indigo-500/20 hover:shadow-sm transition-all duration-300">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
              <Clock className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Last Sync Active</p>
              <p className="text-base font-extrabold text-foreground mt-0.5">
                {lastRunAgo !== null ? (
                  lastRunAgo < 1 ? "Just now" : `${lastRunAgo}m ago`
                ) : (
                  "Never"
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Provider Cards */}
      <div className="space-y-4">
        {providers?.map((provider) => {
          const statusConfig = {
            SUCCESS: {
              glow: "hover:shadow-emerald-500/5 hover:border-emerald-500/30",
              badge: "success" as const,
              iconColor: "text-emerald-500",
              bgColor: "bg-emerald-500/10",
            },
            FAILED: {
              glow: "hover:shadow-red-500/5 hover:border-red-500/30",
              badge: "destructive" as const,
              iconColor: "text-red-500",
              bgColor: "bg-red-500/10",
            },
            RUNNING: {
              glow: "hover:shadow-blue-500/5 hover:border-blue-500/30",
              badge: "info" as const,
              iconColor: "text-blue-500",
              bgColor: "bg-blue-500/10 animate-pulse",
            },
          }[provider.lastStatus as "SUCCESS" | "FAILED" | "RUNNING"] || {
            glow: "hover:shadow-muted/5 hover:border-border/30",
            badge: "secondary" as const,
            iconColor: "text-muted-foreground",
            bgColor: "bg-muted",
          };

          return (
            <Card
              key={provider.id}
              className={cn(
                "transition-all duration-300 hover:-translate-y-0.5 bg-card/60 backdrop-blur-sm border border-border/30 hover:shadow-md",
                statusConfig.glow
              )}
            >
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {/* Logo placeholder with animated status background */}
                    <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-300 shadow-sm", statusConfig.bgColor)}>
                      <Globe className={cn("h-5 w-5 transition-transform duration-300", statusConfig.iconColor)} />
                    </div>

                    {/* Info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm text-foreground/90">{provider.name}</h3>
                        <Badge
                          variant={statusConfig.badge}
                          className="text-[9px] font-extrabold px-1.5 h-4.5"
                        >
                          {provider.lastStatus === "RUNNING" && (
                            <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />
                          )}
                          {provider.lastStatus}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px] sm:max-w-xs font-medium">
                        {provider.baseUrl}
                      </p>
                      {provider.lastRunAt && (
                        <p className="text-[10px] text-muted-foreground/80 mt-1 font-semibold">
                          Last run: {new Date(provider.lastRunAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Controls (Actions) */}
                  <div className="flex items-center gap-2 flex-wrap self-end sm:self-center">
                    <div className="flex items-center gap-2 bg-background/50 border border-border/30 rounded-xl px-3 py-1.5 shadow-sm mr-1 h-9">
                      <span className="text-xs font-semibold text-muted-foreground">Active</span>
                      <Switch
                        checked={provider.isEnabled}
                        onCheckedChange={(checked) =>
                          handleToggleEnabled(provider.id, checked)
                        }
                        className="scale-90"
                      />
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTest(provider.id)}
                      disabled={testProvider.isPending}
                      className="text-xs font-bold gap-1 border-border/40 hover:bg-accent h-9"
                    >
                      <TestTube className="h-3 w-3" />
                      Test
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleScrape(provider.id)}
                      disabled={triggerScrape.isPending}
                      className="text-xs font-bold gap-1 border-border/40 hover:bg-accent h-9"
                    >
                      <Play className="h-3 w-3 text-indigo-500 fill-indigo-500" />
                      Scrape
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRetry(provider.id)}
                      disabled={retryProvider.isPending}
                      className="text-xs font-bold gap-1 border-border/40 hover:bg-accent h-9"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Retry
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setExpandedId(
                          expandedId === provider.id ? null : provider.id
                        )
                      }
                      className="h-9 w-9 rounded-lg hover:bg-muted/80"
                    >
                      {expandedId === provider.id ? (
                        <ChevronUp className="h-4.5 w-4.5" />
                      ) : (
                        <ChevronDown className="h-4.5 w-4.5" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Expanded details */}
                {expandedId === provider.id && (
                  <>
                    <Separator className="my-4 border-border/40" />
                    <ProviderDetails
                      provider={provider}
                      onTimeoutSave={(ms) =>
                        handleTimeoutSave(provider.id, ms)
                      }
                      onViewAllLogs={() => setLogViewerId(provider.id)}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Log Viewer Dialog */}
      {logViewerProvider && (
        <LogViewerDialog
          provider={logViewerProvider}
          open={!!logViewerId}
          onClose={() => setLogViewerId(null)}
        />
      )}
    </div>
  );
}
