import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";

const statusPill = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
};

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export default function PublicInvoice() {
  const { token } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/public/invoices/${token}`)
      .then(({ data }) => setInvoice(data))
      .catch(() => setError("This invoice link is invalid or has expired."));
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-gray-500">{error}</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const brandColor = invoice.owner.brandColor || "#4f46e5";
  const subtotal = invoice.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = (subtotal - invoice.discount) * (invoice.taxRate / 100);

  return (
    <div className="min-h-screen bg-gray-100 py-10">
      <div className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            {invoice.owner.logoUrl && (
              <img src={invoice.owner.logoUrl} alt="" className="h-12 w-auto" />
            )}
            <div>
              <div className="text-lg font-bold text-gray-900">
                {invoice.owner.businessName || invoice.owner.name}
              </div>
              {invoice.owner.address && (
                <div className="text-xs text-gray-500">{invoice.owner.address}</div>
              )}
              {invoice.owner.phone && (
                <div className="text-xs text-gray-500">{invoice.owner.phone}</div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold" style={{ color: brandColor }}>
              INVOICE
            </div>
            <div className="text-sm text-gray-500">#{invoice.number}</div>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusPill[invoice.status]}`}>
              {invoice.status}
            </span>
          </div>
        </div>

        <div className="mb-6 h-0.5" style={{ backgroundColor: brandColor }} />

        <div className="mb-6 flex justify-between">
          <div>
            <div className="text-xs font-medium text-gray-400">BILL TO</div>
            <div className="text-sm font-medium text-gray-900">{invoice.client.name}</div>
            {invoice.client.company && (
              <div className="text-sm text-gray-500">{invoice.client.company}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs font-medium text-gray-400">DUE</div>
            <div className="text-sm text-gray-900">{new Date(invoice.dueDate).toLocaleDateString()}</div>
          </div>
        </div>

        <table className="mb-6 w-full text-sm">
          <thead>
            <tr className="text-white" style={{ backgroundColor: brandColor }}>
              <th className="px-3 py-2 text-left font-medium">Description</th>
              <th className="px-3 py-2 text-left font-medium">Qty</th>
              <th className="px-3 py-2 text-left font-medium">Unit price</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={item.id} className={index % 2 === 1 ? "bg-gray-50" : ""}>
                <td className="px-3 py-2">{item.description}</td>
                <td className="px-3 py-2">{item.quantity}</td>
                <td className="px-3 py-2">${item.unitPrice.toFixed(2)}</td>
                <td className="px-3 py-2 text-right">${(item.quantity * item.unitPrice).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mb-6 ml-auto flex max-w-xs flex-col gap-1 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Discount</span>
              <span>-${invoice.discount.toFixed(2)}</span>
            </div>
          )}
          {invoice.taxRate > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Tax ({invoice.taxRate}%)</span>
              <span>${taxAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-1 text-base font-bold text-gray-900">
            <span>Total</span>
            <span>${invoice.amount.toFixed(2)}</span>
          </div>
        </div>

        {invoice.notes && (
          <div className="mb-6 text-sm text-gray-600">
            <div className="mb-1 text-xs font-medium text-gray-400">NOTES</div>
            {invoice.notes}
          </div>
        )}

        <a
          href={`${API_BASE}/public/invoices/${token}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="inline-block rounded-md px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: brandColor }}
        >
          Download PDF
        </a>
      </div>
    </div>
  );
}
