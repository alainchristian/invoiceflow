import { type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      neutral: "bg-surface-hover text-fg-secondary",
      brand: "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200",
      success: "bg-success-bg text-success",
      warning: "bg-warning-bg text-warning",
      danger: "bg-danger-bg text-danger",
      info: "bg-info-bg text-info",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  DRAFT: "neutral",
  SENT: "info",
  VIEWED: "brand",
  PAID: "success",
  OVERDUE: "danger",
  CANCELLED: "neutral",
  ACCEPTED: "success",
  REJECTED: "danger",
  EXPIRED: "neutral",
  CONVERTED: "brand",
  ACTIVE: "success",
  PAUSED: "warning",
  ENDED: "neutral",
  ISSUED: "success",
  VOID: "danger",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "neutral"} className="capitalize">
      {status.toLowerCase()}
    </Badge>
  );
}
