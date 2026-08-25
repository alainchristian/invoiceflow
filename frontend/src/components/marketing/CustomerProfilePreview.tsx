// A static, non-interactive mock of the customer detail page -- marketing
// art only, mirroring the real CustomerDetail page's actual layout.
const invoices = [
  { id: "INV-2026-0055", date: "May 28, 2026", amount: "$1,250.00", status: "Sent" },
  { id: "INV-2026-0048", date: "May 20, 2026", amount: "$2,500.00", status: "Paid" },
  { id: "INV-2026-0035", date: "May 10, 2026", amount: "$1,200.00", status: "Paid" },
];

const statusStyle: Record<string, string> = {
  Sent: "bg-info-bg text-info",
  Paid: "bg-success-bg text-success",
};

export function CustomerProfilePreview() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-5">
        <p className="text-sm font-semibold text-fg">Acme Corporation</p>
        <p className="text-xs text-fg-muted">billing@acmecorp.com</p>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-[10px] text-fg-muted">Total invoiced</p>
          <p className="mt-1 text-sm font-semibold text-fg">$12,450.00</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-[10px] text-fg-muted">Paid</p>
          <p className="mt-1 text-sm font-semibold text-success">$8,210.00</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-[10px] text-fg-muted">Outstanding</p>
          <p className="mt-1 text-sm font-semibold text-fg">$4,240.00</p>
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <div className="border-b border-border px-3 py-2 text-xs font-medium text-fg-muted">Invoice history</div>
        {invoices.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between border-b border-border px-3 py-2.5 text-xs last:border-0">
            <span className="font-medium text-brand-600">{inv.id}</span>
            <span className="text-fg-secondary">{inv.date}</span>
            <span className="text-fg">{inv.amount}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle[inv.status]}`}>{inv.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
