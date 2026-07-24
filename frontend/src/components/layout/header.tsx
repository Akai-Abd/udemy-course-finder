"use client";

import { useRouter, usePathname } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { NotificationBell } from "./notification-bell";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const getBreadcrumbs = () => {
    if (!pathname) return ["Dashboard"];
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 0) return ["Dashboard"];
    return parts.map(part => part.charAt(0).toUpperCase() + part.slice(1));
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="flex h-16 items-center justify-between border-b border-border/40 bg-background/60 backdrop-blur-md px-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium tracking-tight text-muted-foreground/60">
          <span>Workspace</span>
          {breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <span className="text-border/80">/</span>
              <span className={index === breadcrumbs.length - 1 ? "text-foreground font-semibold" : ""}>
                {crumb}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full border border-border/40 hover:bg-muted p-0">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  AD
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-popover/95 backdrop-blur-md border border-border/40" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-bold leading-none text-foreground/90">Admin</p>
                <p className="text-xs leading-none text-muted-foreground">
                  admin@localhost.local
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border/40" />
            <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer font-medium hover:bg-accent">
              <User className="mr-2 h-4 w-4 text-muted-foreground" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/40" />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer font-semibold text-destructive focus:text-destructive focus:bg-destructive/10">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
