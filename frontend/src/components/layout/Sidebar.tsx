import { NavLink, Link } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  FileSignature,
  Repeat,
  Receipt,
  Users,
  Package,
  Wallet,
  BarChart3,
  Building2,
  UsersRound,
  CreditCard,
  Mail,
  ChevronsLeft,
  ChevronsRight,
  Shield,
  X,
  Webhook,
  Clock,
  Banknote,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

const mainLinks = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/app/invoices", label: "Invoices", icon: FileText },
  { to: "/app/quotes", label: "Quotes", icon: FileSignature },
  { to: "/app/recurring", label: "Recurring Invoices", icon: Repeat },
  { to: "/app/customers", label: "Customers", icon: Users },
  { to: "/app/products", label: "Products & Services", icon: Package },
  { to: "/app/time-tracking", label: "Time Tracking", icon: Clock },
  { to: "/app/expenses", label: "Expenses", icon: Banknote },
  { to: "/app/payments", label: "Payments", icon: Wallet },
  { to: "/app/credit-notes", label: "Credit Notes", icon: Receipt },
];

const settingsLinks = [
  { to: "/app/settings/company", label: "Company", icon: Building2 },
  { to: "/app/settings/team", label: "Team", icon: UsersRound },
  { to: "/app/settings/billing", label: "Billing & Subscription", icon: CreditCard },
  { to: "/app/settings/statements", label: "Customer Statements", icon: Mail },
  { to: "/app/settings/developer", label: "Developer", icon: Webhook },
];

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
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive ? "bg-brand-600 text-white" : "text-fg-secondary hover:bg-surface-hover hover:text-fg"
        )
      }
      title={collapsed ? label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, organizations, activeOrg, switchOrganization, logout } = useAuth();

  // The icon-only collapse toggle is a desktop convenience -- the mobile
  // drawer is an overlay, so it always shows full labels regardless of
  // whatever the desktop collapse state happens to be.
  const iconOnly = collapsed && !mobileOpen;

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
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">
            I
          </div>
          {!iconOnly && <span className="flex-1 truncate font-semibold text-fg">InvoiceFlow</span>}
          <button onClick={onClose} className="rounded-md p-1.5 text-fg-muted hover:bg-surface-hover hover:text-fg lg:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-4">
            {!iconOnly && <p className="mb-2 px-3 text-xs font-semibold uppercase text-fg-muted">Main</p>}
            <nav className="flex flex-col gap-0.5">
              {mainLinks.map((link) => (
                <NavItem key={link.to} {...link} collapsed={iconOnly} onNavigate={onClose} />
              ))}
            </nav>
          </div>

          <div>
            {!iconOnly && <p className="mb-2 px-3 text-xs font-semibold uppercase text-fg-muted">Settings</p>}
            <nav className="flex flex-col gap-0.5">
              {settingsLinks.map((link) => (
                <NavItem key={link.to} {...link} collapsed={iconOnly} onNavigate={onClose} />
              ))}
            </nav>
          </div>

          {!!user?.platformRole && (
            <div className="mt-4">
              {!iconOnly && <p className="mb-2 px-3 text-xs font-semibold uppercase text-fg-muted">Platform</p>}
              <Link
                to="/admin"
                onClick={onClose}
                title={iconOnly ? "Platform Admin" : undefined}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg"
              >
                <Shield className="h-4 w-4 shrink-0" />
                {!iconOnly && <span>Platform Admin</span>}
              </Link>
            </div>
          )}
        </div>

        <div className="border-t border-border p-3">
          {!iconOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="mb-2 flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-fg-secondary hover:bg-surface-hover">
                  <span className="truncate font-medium text-fg">{activeOrg?.name ?? "Select organization"}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                {organizations.map((org) => (
                  <DropdownMenuItem key={org.id} onClick={() => switchOrganization(org.id)}>
                    {org.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div className="flex items-center justify-between px-1">
            {!iconOnly && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{user?.name}</p>
                <button onClick={logout} className="text-xs text-fg-muted hover:text-fg-secondary">
                  Sign out
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
