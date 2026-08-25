import { Badge, type BadgeProps } from "@/components/ui/Badge";
import type { TenantStatus } from "@/hooks/useAdmin";

const STATUS_VARIANT: Record<TenantStatus, BadgeProps["variant"]> = {
  ACTIVE: "success",
  TRIAL: "brand",
  PAST_DUE: "warning",
  SUSPENDED: "danger",
  CANCELLED: "neutral",
};

const STATUS_LABEL: Record<TenantStatus, string> = {
  ACTIVE: "Active",
  TRIAL: "Trial",
  PAST_DUE: "Past due",
  SUSPENDED: "Suspended",
  CANCELLED: "Cancelled",
};

export function TenantStatusBadge({ status }: { status: TenantStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
