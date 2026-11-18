"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  LogOut,
  User,
  Menu,
  LayoutDashboard,
  Search,
  Heart,
  History,
  Globe,
  BarChart3,
  Settings,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./notification-bell";

const mobileNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/courses", label: "Courses", icon: Search },
  { href: "/favorites", label: "Favorites", icon: Heart },
  { href: "/history", label: "History", icon: History },
  { href: "/sources", label: "Sources", icon: Globe },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const getBreadcrumbs = () => {
    if (!pathname) return ["Dashboard"];
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 0) return ["Dashboard"];
    return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1));
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="flex h-16 items-center justify-between border-b border-border/40 bg-background/60 backdrop-blur-md px-4 sm:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile Sidebar Menu Trigger */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9 rounded-xl border border-border/40"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-72 p-0 bg-sidebar border-r border-border/40"
          >
            <SheetHeader className="p-4 border-b border-border/40 text-left">
              <SheetTitle className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-md shadow-indigo-500/10">
                  <Image
                    src="/icon.png"
                    alt="Udemy Finder Logo"
                    width={36}
                    height={36}
                    className="h-full w-full object-cover"
                    priority
                  />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-bold text-sm tracking-tight gradient-text">
                    Udemy Finder
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    Course Discovery
                  </span>
                </div>
              </SheetTitle>
            </SheetHeader>
            <nav className="space-y-1.5 p-3">
              {mobileNavItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-bold border border-border/30"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4",
                        isActive
                          ? "text-sidebar-primary"
                          : "text-sidebar-foreground/60",
                      )}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium tracking-tight text-muted-foreground/60">
          <span>Workspace</span>
          {breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <span className="text-border/80">/</span>
              <span
                className={
                  index === breadcrumbs.length - 1
                    ? "text-foreground font-semibold"
                    : ""
                }
              >
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
            <Button
              variant="ghost"
              className="relative h-10 w-10 rounded-full p-0.5 group overflow-visible"
            >
              <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-600 opacity-80 blur-[2px] animate-earth-orbit group-hover:opacity-100 transition-opacity" />
              <Avatar className="relative h-9 w-9 rounded-full border-2 border-background bg-background p-0.5 shadow-lg overflow-hidden animate-earth-pulse">
                <AvatarImage
                  src="/admin-avatar.png"
                  alt="Admin Logo"
                  className="object-cover rounded-full transition-transform duration-700 group-hover:scale-110"
                />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  AD
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56 bg-popover/95 backdrop-blur-md border border-border/40"
            align="end"
            forceMount
          >
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-bold leading-none text-foreground/90">
                  Admin
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  admin@localhost.local
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border/40" />
            <DropdownMenuItem
              asChild
              className="cursor-pointer font-medium hover:bg-accent"
            >
              <Link href="/settings" className="flex items-center w-full">
                <User className="mr-2 h-4 w-4 text-muted-foreground" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/40" />
            <DropdownMenuItem
              onSelect={handleLogout}
              onClick={handleLogout}
              className="cursor-pointer font-semibold text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
