import { MoreHorizontal, Eye, LogIn, Bell, Ban, CheckCircle2, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/DropdownMenu";
import type { AdminOrgListItem } from "@/hooks/useAdmin";

export function TenantActionsMenu({
  tenant,
  onView,
  onImpersonate,
  onNotify,
  onSuspend,
  onReactivate,
  onDelete,
  canMutate,
  canDelete,
}: {
  tenant: AdminOrgListItem;
  onView: () => void;
  onImpersonate: () => void;
  onNotify: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
  onDelete: () => void;
  canMutate: boolean;
  canDelete: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-md p-1.5 text-fg-muted hover:bg-surface-hover hover:text-fg">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onView}>
          <Eye className="mr-2 h-4 w-4" /> View tenant
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onImpersonate}>
          <LogIn className="mr-2 h-4 w-4" /> Login as tenant
        </DropdownMenuItem>
        {canMutate && (
          <DropdownMenuItem onSelect={onNotify}>
            <Bell className="mr-2 h-4 w-4" /> Send notification
          </DropdownMenuItem>
        )}
        {canMutate && (
          <>
            <DropdownMenuSeparator />
            {tenant.suspended ? (
              <DropdownMenuItem onSelect={onReactivate}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Reactivate tenant
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={onSuspend} className="text-danger">
                <Ban className="mr-2 h-4 w-4" /> Suspend tenant
              </DropdownMenuItem>
            )}
          </>
        )}
        {canDelete && (
          <DropdownMenuItem onSelect={onDelete} className="text-danger">
            <Trash2 className="mr-2 h-4 w-4" /> Delete tenant
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
