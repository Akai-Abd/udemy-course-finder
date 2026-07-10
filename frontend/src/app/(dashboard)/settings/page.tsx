"use client";

import { useState, useEffect } from "react";
import { User, Shield, Database, Info, Clock, KeyRound, Loader2, Globe } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { authApi, settingsApi } from "@/lib/api-client";
import { toast } from "sonner";

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChanging, setIsChanging] = useState(false);

  const [proxies, setProxies] = useState("");
  const [isSavingProxies, setIsSavingProxies] = useState(false);
  const [isTestingProxies, setIsTestingProxies] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    settingsApi.get("proxies")
      .then((res) => {
        setProxies(res.data.value || "");
      })
      .catch(() => {});
  }, []);

  const handleSaveProxies = async () => {
    setIsSavingProxies(true);
    try {
      await settingsApi.update("proxies", proxies);
      toast.success("Scraper proxy list saved successfully");
    } catch (err: any) {
      toast.error("Failed to save proxy list: " + (err.message || "Unknown error"));
    } finally {
      setIsSavingProxies(false);
    }
  };

  const handleTestProxies = () => {
    setIsTestingProxies(true);
    setTestResult(null);

    setTimeout(() => {
      const lines = proxies.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) {
        setTestResult("No proxies listed to test.");
        setIsTestingProxies(false);
        return;
      }

      let valid = 0;
      let invalid = 0;
      const logs: string[] = [];

      const proxyRegex = /^(https?|socks[45]):\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)$/;

      lines.forEach((line, index) => {
        const match = proxyRegex.test(line);
        if (match) {
          valid++;
          logs.push(`Line ${index + 1}: Syntax OK (${line.split('@').pop()})`);
        } else {
          invalid++;
          logs.push(`Line ${index + 1}: Syntax INVALID - Must be protocol://[user:pass@]host:port`);
        }
      });

      setTestResult(
        `Checked ${lines.length} proxy lines:\n` +
          `✅ Valid Syntax: ${valid}\n` +
          `❌ Invalid Syntax: ${invalid}\n\n` +
          `Logs:\n` +
          logs.join("\n") +
          `\n\nNote: To verify physical connectivity, save this list and trigger a "Test Connection" from the Sources tab.`
      );

      setIsTestingProxies(false);
    }, 800);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      toast.error("Password must include uppercase, lowercase, and a number");
      return;
    }

    setIsChanging(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to change password";
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl animate-fade-in select-none">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm font-medium">
          Application configuration and account credentials options.
        </p>
      </div>

      {/* Profile */}
      <Card className="border border-border/30 bg-card/45 backdrop-blur-sm shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground/90">
            <User className="h-4.5 w-4.5 text-indigo-500" />
            Profile Account
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground/80">Your profile credentials info</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email Address</p>
              <p className="text-sm font-bold text-foreground/90 mt-0.5">admin@localhost</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">User Permission Role</p>
              <Badge variant="secondary" className="mt-0.5 text-[10px] font-extrabold bg-primary/10 text-primary border border-primary/10">Admin</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="border border-border/30 bg-card/45 backdrop-blur-sm shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground/90">
            <Shield className="h-4.5 w-4.5 text-indigo-500" />
            Security Protocol
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground/80">
            Authentication mechanisms and server security parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Authentication</p>
              <p className="text-xs font-bold text-foreground/90 mt-0.5">JWT Tokens</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Password Hash</p>
              <p className="text-xs font-bold text-foreground/90 mt-0.5">Argon2id</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Access Expiry</p>
              <p className="text-xs font-bold text-foreground/90 mt-0.5">15 minutes</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Refresh Expiry</p>
              <p className="text-xs font-bold text-foreground/90 mt-0.5">7 days</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="border border-border/30 bg-card/45 backdrop-blur-sm shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground/90">
            <KeyRound className="h-4.5 w-4.5 text-indigo-500" />
            Update Password
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground/80">
            Keep your administrative credentials safe
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4.5 max-w-md">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80" htmlFor="current-password">
                Current Password
              </label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3 py-2 text-sm shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary focus:shadow-primary/5 font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80" htmlFor="new-password">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3 py-2 text-sm shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary focus:shadow-primary/5 font-semibold"
              />
              <p className="text-[10px] text-muted-foreground font-semibold leading-relaxed">
                Requires at least 8 characters containing uppercase, lowercase, and numeric digits.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80" htmlFor="confirm-password">
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3 py-2 text-sm shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary focus:shadow-primary/5 font-semibold"
              />
            </div>
            <Button
              type="submit"
              variant="gradient"
              disabled={isChanging || !currentPassword || !newPassword || !confirmPassword}
              className="inline-flex items-center gap-2 rounded-xl h-10 px-4 text-xs font-bold shadow-md shadow-primary/10 hover:shadow-primary/20"
            >
              {isChanging && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isChanging ? "Changing..." : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Scraping Schedule */}
      <Card className="border border-border/30 bg-card/45 backdrop-blur-sm shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground/90">
            <Clock className="h-4.5 w-4.5 text-indigo-500" />
            Automatic Scraper Interval
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground/80">
            Automatic background Discovery configurations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Scrape Interval</p>
              <p className="text-xs font-bold text-foreground/90 mt-0.5">Every 30 minutes</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Request Delay</p>
              <p className="text-xs font-bold text-foreground/90 mt-0.5">2.0s sleep</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">URL Validation</p>
              <p className="text-xs font-bold text-foreground/90 mt-0.5">Enabled (Active)</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Targets</p>
              <p className="text-xs font-bold text-foreground/90 mt-0.5">9 coupon networks</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scraper Proxies */}
      <Card className="border border-border/30 bg-card/45 backdrop-blur-sm shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground/90">
            <Globe className="h-4.5 w-4.5 text-indigo-500" />
            Scraper Proxies
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground/80">
            Configure rotating HTTP/SOCKS5 proxies for scraping and link verification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80" htmlFor="proxies">
              Proxies List (One URL per line)
            </label>
            <textarea
              id="proxies"
              rows={4}
              value={proxies}
              onChange={(e) => setProxies(e.target.value)}
              placeholder="http://username:password@ip:port&#10;socks5://ip:port"
              className="w-full rounded-xl border border-border/40 bg-background/50 px-3 py-2 text-sm shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary focus:shadow-primary/5 font-mono text-xs font-medium min-h-[100px]"
            />
            <p className="text-[10px] text-muted-foreground font-semibold leading-relaxed">
              Format: `protocol://[user:password@]host:port`. SOCKS5 or HTTP protocols are supported.
            </p>
          </div>
          
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="gradient"
                onClick={handleSaveProxies}
                disabled={isSavingProxies}
                className="inline-flex items-center gap-2 rounded-xl h-9 px-4 text-xs font-bold shadow-md shadow-primary/10 hover:shadow-primary/20"
              >
                {isSavingProxies && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Proxy List
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleTestProxies}
                disabled={isTestingProxies || !proxies.trim()}
                className="inline-flex items-center gap-2 rounded-xl h-9 px-4 text-xs font-bold border-border/40 hover:bg-muted/60"
              >
                {isTestingProxies && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Test Proxies
              </Button>
            </div>
            
            {testResult && (
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/20 mt-1 select-text">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Test Connection Logs</p>
                <pre className="text-[10px] font-mono text-foreground/90 whitespace-pre-wrap break-all leading-normal max-h-[120px] overflow-y-auto">
                  {testResult}
                </pre>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* System Info */}
      <Card className="border border-border/30 bg-card/45 backdrop-blur-sm shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground/90">
            <Database className="h-4.5 w-4.5 text-indigo-500" />
            Stack Infrastructure
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground/80">Active containers and microservices configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Frontend</p>
              <p className="text-xs font-bold text-foreground/90 mt-0.5">Next.js 16 (Turbopack)</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Backend</p>
              <p className="text-xs font-bold text-foreground/90 mt-0.5">NestJS + Prisma</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Database Core</p>
              <p className="text-xs font-bold text-foreground/90 mt-0.5">PostgreSQL 16</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cache / Queue</p>
              <p className="text-xs font-bold text-foreground/90 mt-0.5">Redis 7 + BullMQ</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Crawler engine</p>
              <p className="text-xs font-bold text-foreground/90 mt-0.5">Python 3.12</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deployment env</p>
              <p className="text-xs font-bold text-foreground/90 mt-0.5">Docker Compose</p>
            </div>
          </div>

          <Separator className="border-border/30 my-4" />

          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-muted/40 border border-border/20">
            <Info className="h-4.5 w-4.5 text-muted-foreground/60 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed font-medium">
              Udemy Course Finder aggregates free Udemy courses from 9 coupon sources. All scraping, filtering,
              and storage happens locally via Docker Compose.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
