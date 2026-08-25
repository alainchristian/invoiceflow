// A static, non-interactive mock of the payment-tracking / analytics view --
// marketing art only, mirroring the real Dashboard + Analytics pages.
const bars = [30, 45, 38, 60, 50, 70, 55, 80, 65, 75, 58, 85];
const topCustomers = [
  { name: "Acme Corporation", amount: "$6,850" },
  { name: "Bright Consulting", amount: "$3,200" },
  { name: "TechPro Inc.", amount: "$4,900" },
];

export function PaymentTrackingPreview() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-xs text-fg-muted">Outstanding Invoices</p>
          <p className="mt-1 text-lg font-bold text-fg">$8,240</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-xs text-fg-muted">Overdue</p>
          <p className="mt-1 text-lg font-bold text-danger">$1,850</p>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-background p-3">
        <p className="mb-2 text-xs font-medium text-fg-muted">Invoices Over Time</p>
        <div className="flex h-20 items-end gap-1">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 rounded-t bg-brand-500" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background">
        <div className="border-b border-border px-3 py-2 text-xs font-medium text-fg-muted">Top Customers</div>
        {topCustomers.map((c) => (
          <div key={c.name} className="flex items-center justify-between border-b border-border px-3 py-2.5 text-xs last:border-0">
            <span className="text-fg">{c.name}</span>
            <span className="font-medium text-fg">{c.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
