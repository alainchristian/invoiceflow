import { LayoutDashboard, FileText, FileSignature, Users, Package, Wallet, Repeat, BarChart3 } from "lucide-react";

// A static, non-interactive mock of the app dashboard used purely as hero
// art on the marketing page -- not real data, but the nav items mirror the
// real app's actual Sidebar so the preview isn't a made-up interface.
const revenuePoints = [22, 30, 26, 38, 33, 40, 36, 46, 41, 48, 44, 55];
const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: FileText, label: "Invoices" },
  { icon: FileSignature, label: "Quotes" },
  { icon: Repeat, label: "Recurring" },
  { icon: Users, label: "Customers" },
  { icon: Package, label: "Products" },
  { icon: Wallet, label: "Payments" },
  { icon: BarChart3, label: "Analytics" },
];

function revenuePath(points: number[], width: number, height: number) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const step = width / (points.length - 1);
  return points
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p - min) / (max - min)) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function DashboardPreview() {
  const w = 260;
  const h = 64;
  const linePath = revenuePath(revenuePoints, w, h);
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`;

  return (
    <div className="flex overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="hidden w-36 shrink-0 flex-col gap-0.5 border-r border-border bg-background p-3 sm:flex">
        <div className="mb-3 flex items-center gap-1.5 px-1">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-brand-600 text-[10px] font-bold text-white">
            I
          </div>
          <span className="text-xs font-semibold text-fg">InvoiceFlow</span>
        </div>
        {navItems.map((item) => (
          <div
            key={item.label}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px] font-medium ${
              item.active ? "bg-brand-600 text-white" : "text-fg-muted"
            }`}
          >
            <item.icon className="h-3 w-3 shrink-0" />
            {item.label}
          </div>
        ))}
      </div>

      <div className="min-w-0 flex-1 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-fg">Good morning, Christian</p>
            <p className="text-xs text-fg-muted">Here's what's happening with your business today.</p>
          </div>
          <div className="hidden rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white sm:block">
            Create Invoice
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Revenue", value: "$24,500" },
            { label: "Outstanding", value: "$8,240" },
            { label: "Overdue", value: "$1,850" },
            { label: "Paid", value: "$12,600" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-border bg-background p-2">
              <p className="text-[10px] text-fg-muted">{kpi.label}</p>
              <p className="text-sm font-semibold text-fg">{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="col-span-2 rounded-lg border border-border bg-background p-3">
            <p className="mb-2 text-[10px] font-medium text-fg-muted">Revenue Overview</p>
            <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={areaPath} fill="url(#revenueFill)" stroke="none" />
              <path d={linePath} fill="none" stroke="var(--color-brand-600)" strokeWidth="2" />
            </svg>
          </div>
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="mb-2 text-[10px] font-medium text-fg-muted">Invoice Status</p>
            <div className="flex h-20 items-center justify-center">
              <div
                className="h-16 w-16 rounded-full"
                style={{
                  background:
                    "conic-gradient(#22c55e 0% 40%, #3b82f6 40% 65%, #818cf8 65% 85%, #9ca3af 85% 95%, #ef4444 95% 100%)",
                }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background">
          <div className="border-b border-border px-3 py-2 text-[10px] font-medium text-fg-muted">Recent Invoices</div>
          {[
            { id: "INV-2026-1055", customer: "Acme Corporation", amount: "$1,250", status: "Sent" },
            { id: "INV-2026-1054", customer: "Bright Consulting", amount: "$3,200", status: "Paid" },
            { id: "INV-2026-1053", customer: "Global Solutions", amount: "$950", status: "Viewed" },
          ].map((row) => (
            <div key={row.id} className="flex items-center justify-between border-b border-border px-3 py-2 text-xs last:border-0">
              <span className="font-medium text-brand-600">{row.id}</span>
              <span className="hidden text-fg-secondary sm:inline">{row.customer}</span>
              <span className="text-fg">{row.amount}</span>
              <span className="text-fg-muted">{row.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
