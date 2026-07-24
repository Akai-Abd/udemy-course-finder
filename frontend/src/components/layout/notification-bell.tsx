"use client";

import { Bell, CheckCheck, Trash2, Sparkles, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useNotifications,
  useUnreadNotificationsCount,
  useNotificationActions,
} from "@/lib/hooks/use-notifications";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const router = useRouter();
  const { data: notifications } = useNotifications(1, 10);
  const { data: unreadCount = 0 } = useUnreadNotificationsCount();
  const { markRead, markAllRead, deleteNotification } = useNotificationActions();

  const getIcon = (type: string) => {
    switch (type) {
      case "NEW_COURSES":
        return <Sparkles className="h-3.5 w-3.5 text-indigo-500 shrink-0" />;
      case "EXPIRING_SOON":
        return <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
      default:
        return <AlertCircle className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
    }
  };

  const handleNotificationClick = (id: string, metadata?: Record<string, unknown>) => {
    markRead.mutate(id);
    if (metadata?.courseId && typeof metadata.courseId === "string") {
      router.push(`/courses/${metadata.courseId}`);
    } else {
      router.push("/courses");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground relative">
          <Bell className="h-4.5 w-4.5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-extrabold text-white shadow-sm">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-80 sm:w-96 bg-popover/95 backdrop-blur-md border border-border/40 p-0" align="end" forceMount>
        <div className="flex items-center justify-between p-3.5 pb-2">
          <DropdownMenuLabel className="p-0 text-xs font-bold text-foreground">
            Notifications {unreadCount > 0 && `(${unreadCount} unread)`}
          </DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead.mutate()}
              className="h-6 text-[10px] font-bold text-indigo-500 hover:text-indigo-600 hover:bg-indigo-500/10 px-2 rounded-lg gap-1"
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator className="bg-border/40 my-0" />

        <div className="max-h-80 overflow-y-auto divide-y divide-border/20">
          {!notifications?.data?.length ? (
            <div className="p-6 text-center text-xs text-muted-foreground font-medium">
              No notifications yet
            </div>
          ) : (
            notifications.data.map((item) => (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item.id, item.metadata)}
                className={cn(
                  "flex items-start gap-3 p-3 text-xs transition-colors cursor-pointer hover:bg-muted/50 group relative",
                  !item.isRead && "bg-indigo-500/5"
                )}
              >
                <div className="mt-0.5">{getIcon(item.type)}</div>
                <div className="flex-1 min-w-0 pr-6">
                  <p className={cn("font-semibold text-foreground/90 truncate text-[11px]", !item.isRead && "font-bold text-foreground")}>
                    {item.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
                    {item.message}
                  </p>
                  <span className="text-[9px] text-muted-foreground/60 mt-1 block">
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification.mutate(item.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-3 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
