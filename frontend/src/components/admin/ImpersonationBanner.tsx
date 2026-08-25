import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAdminOrganization } from "@/hooks/useAdmin";

export function ImpersonationBanner({ organizationId }: { organizationId: string }) {
  const navigate = useNavigate();
  // AuthContext only knows the admin's own real memberships, so the foreign
  // tenant's name has to be looked up separately.
  const { data: tenant } = useAdminOrganization(organizationId);

  return (
    <div className="flex items-center justify-between border-b border-warning/30 bg-warning-bg px-4 py-1.5 text-sm text-warning">
      <span className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4" />
        Admin view: viewing <strong>{tenant?.name ?? "this organization"}</strong> as platform admin
      </span>
      <button onClick={() => navigate("/admin")} className="font-medium underline-offset-2 hover:underline">
        Exit to Platform Admin
      </button>
    </div>
  );
}
