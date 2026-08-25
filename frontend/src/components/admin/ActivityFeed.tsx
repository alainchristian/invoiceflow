import { FileText, CheckCircle2, Wallet, RotateCcw, UserPlus, Shield, Bell, Settings2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ActivityFeedItem } from "@/hooks/useAdmin";

const TYPE_ICON: Record<string, LucideIcon> = {
  invoice_created: FileText,
  invoice_paid: CheckCircle2,
  payment_received: Wallet,
  refund: RotateCcw,
  member_joined: UserPlus,
  suspend_organization: Shield,
  reactivate_organization: Shield,
  delete_organization: Shield,
  impersonation_started: Shield,
  cross_tenant_access: Shield,
  tenant_notification_sent: Bell,
  admin_role_granted: Shield,
  admin_role_changed: Shield,
  admin_role_revoked: Shield,
  platform_settings_updated: Settings2,
};

function groupByDay(items: ActivityFeedItem[]) {
  const groups = new Map<string, ActivityFeedItem[]>();
  for (const item of items) {
    const key = formatDate(item.timestamp);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return Array.from(groups.entries());
}

export function ActivityFeed({ items }: { items: ActivityFeedItem[] }) {
  if (items.length === 0) {
    return <EmptyState icon={Bell} title="No activity yet" description="Activity will appear here as it happens." />;
  }

  return (
    <div className="space-y-6">
      {groupByDay(items).map(([day, dayItems]) => (
        <div key={day}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">{day}</p>
          <div className="space-y-3">
            {dayItems.map((item) => {
              const Icon = TYPE_ICON[item.type] ?? Bell;
              return (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-hover text-fg-muted">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-fg">{item.label}</p>
                    <p className="text-xs text-fg-muted">
                      {new Date(item.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      {item.amount !== undefined && ` · ${formatCurrency(item.amount, item.currency)}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
