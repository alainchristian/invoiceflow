import { useEffect, useState } from "react";
import api from "../api";

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    async function load() {
      const [clientsRes, proposalsRes, invoicesRes] = await Promise.all([
        api.get("/clients"),
        api.get("/proposals"),
        api.get("/invoices"),
      ]);

      const outstanding = invoicesRes.data
        .filter((invoice) => invoice.status !== "paid")
        .reduce((sum, invoice) => sum + invoice.amount, 0);

      setStats({
        clients: clientsRes.data.length,
        proposals: proposalsRes.data.length,
        invoices: invoicesRes.data.length,
        outstanding,
      });
    }
    load();
  }, []);

  if (!stats) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Clients" value={stats.clients} />
        <StatCard label="Proposals" value={stats.proposals} />
        <StatCard label="Invoices" value={stats.invoices} />
        <StatCard label="Outstanding" value={formatCurrency(stats.outstanding)} />
      </div>
    </div>
  );
}
