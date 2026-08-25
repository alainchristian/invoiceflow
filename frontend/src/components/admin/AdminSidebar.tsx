import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Clock,
  Ban,
  CreditCard,
  Receipt,
  UsersRound,
  ScrollText,
  LifeBuoy,
  ShieldCheck,
  Settings2,
  ChevronsLeft,
  ChevronsRight,
  ArrowLeft,
  LogOut,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  PLATFORM_ADMIN: "Platform Admin",
  SUPPORT_ADMIN: "Support Admin",
};

// NavLink's default active-matching only looks at pathname, which can't tell
// "/admin/tenants" apart from "/admin/tenants?status=SUSPENDED" -- several of
// this sidebar's links share a pathname and differ only by query string, so
// active state is computed manually here (full path+search, or an exact
// pathname match for links with no query string).
function NavItem({
  to,
  label,
  icon: Icon,
  end,
  collapsed,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const location = useLocation();
  const [toPath, toSearch] = to.split("?");
  const isActive = toSearch
    ? location.pathname === toPath && location.search === `?${toSearch}`
    : end
      ? location.pathname === toPath && !location.search
      : location.pathname === toPath || location.pathname.startsWith(`${toPath}/`);

  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive ? "bg-brand-600 text-white" : "text-fg-secondary hover:bg-surface-hover hover:text-fg"
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

export function AdminSidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = user?.platformRole === "SUPER_ADMIN";

  // The icon-only collapse toggle is a desktop convenience -- the mobile
  // drawer is an overlay, so it always shows full labels regardless of
  // whatever the desktop collapse state happens to be.
  const iconOnly = collapsed && !mobileOpen;

  function closeOnNavigate() {
    onClose();
  }

  const sections: { label: string; links: { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean }[] }[] = [
    { label: "Overview", links: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true }] },
    {
      label: "Tenant Management",
      links: [
        { to: "/admin/tenants", label: "Tenants", icon: Building2, end: true },
        { to: "/admin/tenants?status=TRIAL", label: "Pending / Trials", icon: Clock },
        { to: "/admin/tenants?status=SUSPENDED", label: "Suspended", icon: Ban },
      ],
    },
    {
      label: "Subscriptions",
      links: [
        { to: "/admin/plans", label: "Plans", icon: CreditCard },
        { to: "/admin/subscriptions", label: "Subscriptions", icon: Receipt },
      ],
    },
    {
      label: "Platform",
      links: [
        { to: "/admin/users", label: "Users", icon: UsersRound },
        { to: "/admin/activity", label: "Activity Logs", icon: ScrollText },
        { to: "/admin/support", label: "Support", icon: LifeBuoy },
      ],
    },
  ];

  if (isSuperAdmin) {
    sections.push({
      label: "System",
      links: [
        { to: "/admin/administrators", label: "Administrators", icon: ShieldCheck },
        { to: "/admin/settings", label: "Settings", icon: Settings2 },
      ],
    });
  }

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-screen flex-col border-r border-border bg-surface transition-all duration-200",
          "lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          iconOnly ? "w-64 lg:w-16" : "w-64"
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">I</div>
          {!iconOnly && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-fg">InvoiceFlow</p>
              <p className="truncate text-[11px] leading-tight text-fg-muted">Platform Administration</p>
            </div>
          )}
          <button onClick={onClose} className="rounded-md p-1.5 text-fg-muted hover:bg-surface-hover hover:text-fg lg:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section.label} className="mb-4">
              {!iconOnly && <p className="mb-2 px-3 text-xs font-semibold uppercase text-fg-muted">{section.label}</p>}
              <nav className="flex flex-col gap-0.5">
                {section.links.map((link) => (
                  <NavItem key={link.to} {...link} collapsed={iconOnly} onNavigate={closeOnNavigate} />
                ))}
              </nav>
            </div>
          ))}

          <button
            onClick={() => {
              navigate("/app");
              onClose();
            }}
            title={iconOnly ? "Back to app" : undefined}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            {!iconOnly && <span>Back to app</span>}
          </button>
        </div>

        <div className="border-t border-border p-3">
          <div className="flex items-center justify-between px-1">
            {!iconOnly && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{user?.name}</p>
                <p className="truncate text-xs text-fg-muted">{user?.platformRole ? ROLE_LABEL[user.platformRole] : ""}</p>
                <button onClick={logout} className="mt-0.5 flex items-center gap-1 text-xs text-fg-muted hover:text-fg-secondary">
                  <LogOut className="h-3 w-3" /> Sign out
                </button>
              </div>
            )}
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="hidden rounded-md p-1.5 text-fg-muted hover:bg-surface-hover hover:text-fg lg:block"
            >
              {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
