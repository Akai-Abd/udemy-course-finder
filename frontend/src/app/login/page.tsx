"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch {
      setError("Invalid email or password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background gradient mesh */}
      <div className="fixed inset-0 -z-10 overflow-hidden bg-background">
        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/3 via-transparent to-violet-500/3" />
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-indigo-500/8 blur-[130px] opacity-70" />
        <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-violet-500/8 blur-[130px] opacity-70" />
      </div>

      <Card className="w-full max-w-md border border-border/30 bg-card/45 backdrop-blur-md shadow-2xl animate-fade-in rounded-2xl select-none">
        <CardHeader className="text-center space-y-4 pb-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-lg shadow-primary/20 animate-pulse-glow">
            <GraduationCap className="h-7 w-7 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-black tracking-tight text-foreground/90">Welcome back</CardTitle>
            <CardDescription className="mt-1.5 text-xs text-muted-foreground/80 font-medium">
              Sign in to manage your Udemy Course Finder
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4.5">
            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/10 p-3 text-xs text-destructive font-semibold animate-fade-in">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@localhost.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-10 bg-background/50 border border-border/40 rounded-xl focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 text-sm font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-10 bg-background/50 border-border/40 rounded-xl focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 text-sm font-semibold"
              />
            </div>

            <Button
              type="submit"
              variant="gradient"
              className="w-full h-10 rounded-xl text-xs font-bold shadow-md shadow-primary/10 hover:shadow-primary/20 mt-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>

            <div className="rounded-xl bg-muted/40 border border-border/20 p-3 mt-4 text-center">
              <p className="text-[10px] text-muted-foreground font-semibold">
                Default credentials: <span className="text-foreground/80 font-bold">admin@localhost.local</span> / <span className="text-foreground/80 font-bold">ChangeMe123!</span>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
