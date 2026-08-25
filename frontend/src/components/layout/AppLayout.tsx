import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppLayout() {
  const { user, organizations, activeOrgId } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // A platform admin who switched into a tenant they don't actually belong
  // to won't have that org in their own `organizations` list -- that's the
  // signal to show the "you're looking at someone else's data" banner.
  const isAdminViewingForeignOrg =
    !!user?.platformRole && !!activeOrgId && !organizations.some((o) => o.id === activeOrgId);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        {isAdminViewingForeignOrg && <ImpersonationBanner organizationId={activeOrgId as string} />}
        <Topbar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
