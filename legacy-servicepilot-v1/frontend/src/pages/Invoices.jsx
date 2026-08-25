import { useEffect, useState } from "react";
import api from "../api";

const statusPill = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
};

function Pill({ status }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusPill[status]}`}>
      {status}
    </span>
  );
}

const emptyItem = { description: "", quantity: 1, unitPrice: 0 };
const emptyForm = { clientId: "", number: "", dueDate: "", taxRate: 0, discount: 0, notes: "" };

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState([{ ...emptyItem }]);

  async function load() {
    const [invoicesRes, clientsRes] = await Promise.all([
      api.get("/invoices"),
      api.get("/clients"),
    ]);
    setInvoices(invoicesRes.data);
    setClients(clientsRes.data);
  }

  useEffect(() => {
    load();
  }, []);

  function updateItem(index, field, value) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function addItem() {
    setItems((prev) => [...prev, { ...emptyItem }]);
  }

  const subtotal = items.reduce(
    (sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0),
    0
  );
  const discount = parseFloat(form.discount) || 0;
  const taxRate = parseFloat(form.taxRate) || 0;
  const taxAmount = (subtotal - discount) * (taxRate / 100);
  const total = subtotal - discount + taxAmount;

  async function handleSubmit(e) {
    e.preventDefault();
    await api.post("/invoices", {
      ...form,
      taxRate,
      discount,
      items: items.map((item) => ({
        description: item.description,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
      })),
    });
    setForm(emptyForm);
    setItems([{ ...emptyItem }]);
    setShowForm(false);
    load();
  }

  async function markPaid(id) {
    await api.patch(`/invoices/${id}/status`, { status: "paid" });
    load();
  }

  async function collectPayment(id) {
    const { data } = await api.post(`/invoices/${id}/create-payment-intent`);
    if (data.simulated) {
      alert(`Simulated payment intent created for $${data.amount.toFixed(2)}.\n${data.message}`);
    } else {
      alert(`Live payment intent created for $${data.amount.toFixed(2)}.`);
    }
  }

  async function downloadPdf(invoice) {
    const response = await api.get(`/invoices/${invoice.id}/pdf`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `invoice-${invoice.number}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  function copyClientLink(invoice) {
    const url = `${window.location.origin}/invoices/public/${invoice.publicToken}`;
    navigator.clipboard.writeText(url);
    alert(`Client link copied to clipboard:\n${url}`);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {showForm ? "Cancel" : "+ New invoice"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <select
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="">Select client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Invoice number"
            value={form.number}
            onChange={(e) => setForm({ ...form, number: e.target.value })}
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />

          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium text-gray-700">Line items</div>
            {items.map((item, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateItem(index, "description", e.target.value)}
                  required
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, "quantity", e.target.value)}
                  className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Unit price"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
                  className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={addItem}
              className="self-start text-sm font-medium text-brand-700 hover:underline"
            >
              + Add line item
            </button>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">Discount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.discount}
                onChange={(e) => setForm({ ...form, discount: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">Tax rate (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.taxRate}
                onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes / payment terms</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col items-end gap-1 rounded-md bg-gray-50 p-3 text-sm">
            <div className="flex w-48 justify-between text-gray-600">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex w-48 justify-between text-gray-600">
                <span>Discount</span>
                <span>-${discount.toFixed(2)}</span>
              </div>
            )}
            {taxRate > 0 && (
              <div className="flex w-48 justify-between text-gray-600">
                <span>Tax ({taxRate}%)</span>
                <span>${taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex w-48 justify-between border-t border-gray-200 pt-1 font-bold text-gray-900">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <button
            type="submit"
            className="self-start rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Save
          </button>
        </form>
      )}

      <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
        {invoices.map((invoice) => (
          <div key={invoice.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="font-medium text-gray-900">#{invoice.number}</div>
              <div className="text-sm text-gray-500">
                {invoice.client?.name} — ${invoice.amount.toFixed(2)} — due{" "}
                {new Date(invoice.dueDate).toLocaleDateString()}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Pill status={invoice.status} />
              <button
                onClick={() => downloadPdf(invoice)}
                className="text-sm font-medium text-gray-600 hover:underline"
              >
                PDF
              </button>
              <button
                onClick={() => copyClientLink(invoice)}
                className="text-sm font-medium text-gray-600 hover:underline"
              >
                Copy link
              </button>
              {invoice.status !== "paid" && (
                <>
                  <button
                    onClick={() => collectPayment(invoice.id)}
                    className="text-sm font-medium text-brand-700 hover:underline"
                  >
                    Collect payment
                  </button>
                  <button
                    onClick={() => markPaid(invoice.id)}
                    className="text-sm font-medium text-green-700 hover:underline"
                  >
                    Mark paid
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {invoices.length === 0 && (
          <div className="px-4 py-6 text-sm text-gray-500">No invoices yet.</div>
        )}
      </div>
    </div>
  );
}
