import type { ReactNode } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Search, Bell, Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/Popover";
import { EmptyState } from "@/components/ui/EmptyState";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/hooks/useNotifications";
import { formatDate } from "@/lib/utils";

export function Topbar({ actions, onMenuClick }: { actions?: ReactNode; onMenuClick: () => void }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const { data: notifData } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const unreadCount = notifData?.unreadCount ?? 0;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2 text-fg-muted">
        <button onClick={onMenuClick} className="rounded-md p-2 text-fg-secondary hover:bg-surface-hover hover:text-fg lg:hidden">
          <Menu className="h-5 w-5" />
        </button>
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden truncate text-sm sm:inline">Search anything...</span>
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-md p-2 text-fg-secondary hover:bg-surface-hover hover:text-fg">
              {resolvedTheme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="mr-2 h-4 w-4" /> Light {theme === "light" && "✓"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="mr-2 h-4 w-4" /> Dark {theme === "dark" && "✓"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor className="mr-2 h-4 w-4" /> System {theme === "system" && "✓"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <PopoverTrigger asChild>
            <button className="relative rounded-md p-2 text-fg-secondary hover:bg-surface-hover hover:text-fg">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent>
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <p className="text-sm font-medium text-fg">Notifications</p>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  Mark all read
                </button>
              )}
            </div>
            {!notifData || notifData.notifications.length === 0 ? (
              <EmptyState icon={Bell} title="No notifications" description="You're all caught up." className="py-8" />
            ) : (
              <div className="max-h-96 divide-y divide-border overflow-y-auto">
                {notifData.notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      if (!n.read) markRead.mutate(n.id);
                      setNotifOpen(false);
                      if (n.invoiceId) navigate(`/app/invoices/${n.invoiceId}`);
                    }}
                    className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-surface-hover"
                  >
                    <div className="flex items-center gap-2">
                      {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />}
                      <p className={`text-sm ${n.read ? "text-fg-secondary" : "font-medium text-fg"}`}>{n.title}</p>
                    </div>
                    <p className="text-xs text-fg-muted">{n.message}</p>
                    <p className="text-xs text-fg-muted">{formatDate(n.createdAt)}</p>
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
          {user?.name?.slice(0, 1).toUpperCase()}
        </div>
      </div>
    </header>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-fg">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-fg-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
