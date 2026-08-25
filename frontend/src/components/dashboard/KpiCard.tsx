import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  change,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  change?: { value: string; positive: boolean };
  icon: LucideIcon;
  tone?: "neutral" | "danger";
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between">
        <div>
          <p className="text-sm text-fg-secondary">{label}</p>
          <p className={cn("mt-2 text-2xl font-semibold", tone === "danger" ? "text-danger" : "text-fg")}>
            {value}
          </p>
          {change && (
            <p
              className={cn(
                "mt-2 flex items-center gap-1 text-xs font-medium",
                change.positive ? "text-success" : "text-danger"
              )}
            >
              {change.positive ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              {change.value}
            </p>
          )}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/40">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
