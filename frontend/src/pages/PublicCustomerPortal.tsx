import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { StatusBadge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Organization } from "@/types";

interface PortalInvoice {
  id: string;
  number: string;
  status: string;
  currency: string;
  total: number;
  amountPaid: number;
  dueDate: string;
  issueDate: string;
  publicToken: string;
}

interface PortalQuote {
  id: string;
  number: string;
  status: string;
  currency: string;
  total: number;
  expiryDate: string | null;
  issueDate: string;
  publicToken: string;
}

interface CustomerPortal {
  id: string;
  name: string;
  email: string | null;
  organization: Organization;
  invoices: PortalInvoice[];
  quotes: PortalQuote[];
}

export default function PublicCustomerPortal() {
  const { token } = useParams();
  const [portal, setPortal] = useState<CustomerPortal | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/public/customers/${token}`)
      .then(({ data }) => setPortal(data))
      .catch(() => setError("This portal link is invalid or has expired."));
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-fg-secondary">{error}</div>
    );
  }
  if (!portal) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-fg-secondary">Loading...</div>;
  }

  const brandColor = portal.organization.brandColor || "#4f46e5";

  return (
    <div className="min-h-screen bg-background py-10">
      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          {portal.organization.logoUrl && <img src={portal.organization.logoUrl} alt="" className="h-12 w-auto" />}
          <div>
            <p className="text-lg font-bold text-fg">{portal.organization.name}</p>
            <p className="text-sm text-fg-secondary">Account portal for {portal.name}</p>
          </div>
        </div>

        <div className="mb-8 h-0.5" style={{ backgroundColor: brandColor }} />

        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-fg">Invoices</h2>
          {portal.invoices.length === 0 ? (
            <p className="text-sm text-fg-secondary">No invoices yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white" style={{ backgroundColor: brandColor }}>
                  <th className="rounded-l-md px-3 py-2 text-left font-medium">Number</th>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="rounded-r-md px-3 py-2 text-right font-medium">Balance due</th>
                </tr>
              </thead>
              <tbody>
                {portal.invoices.map((inv, index) => (
                  <tr key={inv.id} className={index % 2 === 1 ? "bg-surface-hover" : ""}>
                    <td className="px-3 py-2">
                      <Link to={`/i/${inv.publicToken}`} className="font-medium text-brand-600 hover:underline">
                        {inv.number}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{formatDate(inv.issueDate)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrency(inv.total, inv.currency)}</td>
                    <td className="px-3 py-2 text-right">
                      {formatCurrency(inv.total - inv.amountPaid, inv.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-fg">Quotes</h2>
          {portal.quotes.length === 0 ? (
            <p className="text-sm text-fg-secondary">No quotes yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white" style={{ backgroundColor: brandColor }}>
                  <th className="rounded-l-md px-3 py-2 text-left font-medium">Number</th>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="rounded-r-md px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {portal.quotes.map((q, index) => (
                  <tr key={q.id} className={index % 2 === 1 ? "bg-surface-hover" : ""}>
                    <td className="px-3 py-2">
                      <Link to={`/q/${q.publicToken}`} className="font-medium text-brand-600 hover:underline">
                        {q.number}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{formatDate(q.issueDate)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={q.status} />
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrency(q.total, q.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
