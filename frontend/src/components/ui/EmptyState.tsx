import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-16 text-center", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover">
        <Icon className="h-6 w-6 text-fg-muted" />
      </div>
      <div>
        <p className="font-medium text-fg">{title}</p>
        <p className="mt-1 max-w-xs text-sm text-fg-secondary">{description}</p>
      </div>
      {action}
    </div>
  );
}
