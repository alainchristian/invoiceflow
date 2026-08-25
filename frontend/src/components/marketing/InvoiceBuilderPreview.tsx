// A static, non-interactive mock of the invoice creation form -- marketing
// art only, mirroring the real InvoiceForm's fields and totals math.
const items = [
  { description: "Web Design", qty: 1, price: "$2,000.00", amount: "$2,000.00" },
  { description: "Hosting & Maintenance", qty: 12, price: "$50.00", amount: "$600.00" },
];

export function InvoiceBuilderPreview() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-5 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">New Invoice</span>
        <span className="text-xs text-fg-muted">INV-2026-0061</span>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-fg-muted">Customer</p>
          <p className="mt-1 rounded-md border border-border bg-background px-2 py-1.5 text-fg">Acme Corporation</p>
        </div>
        <div>
          <p className="text-fg-muted">Currency</p>
          <p className="mt-1 rounded-md border border-border bg-background px-2 py-1.5 text-fg">USD</p>
        </div>
        <div>
          <p className="text-fg-muted">Issue date</p>
          <p className="mt-1 rounded-md border border-border bg-background px-2 py-1.5 text-fg">Aug 24, 2026</p>
        </div>
        <div>
          <p className="text-fg-muted">Due date</p>
          <p className="mt-1 rounded-md border border-border bg-background px-2 py-1.5 text-fg">Sep 23, 2026</p>
        </div>
      </div>

      <div className="mb-4 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-background text-fg-muted">
              <th className="px-3 py-2 text-left font-medium">Description</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Price</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.description} className="border-t border-border">
                <td className="px-3 py-2 text-fg">{item.description}</td>
                <td className="px-3 py-2 text-right text-fg-secondary">{item.qty}</td>
                <td className="px-3 py-2 text-right text-fg-secondary">{item.price}</td>
                <td className="px-3 py-2 text-right font-medium text-fg">{item.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ml-auto flex max-w-[180px] flex-col gap-1 text-xs">
        <div className="flex justify-between text-fg-secondary">
          <span>Subtotal</span>
          <span>$2,600.00</span>
        </div>
        <div className="flex justify-between text-fg-secondary">
          <span>Tax (10%)</span>
          <span>$260.00</span>
        </div>
        <div className="flex justify-between text-fg-secondary">
          <span>Discount</span>
          <span>-$100.00</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-border pt-1 text-sm font-bold text-fg">
          <span>Total</span>
          <span>$2,760.00</span>
        </div>
      </div>
    </div>
  );
}
