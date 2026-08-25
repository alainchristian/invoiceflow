import { useEffect, useState } from "react";
import api from "../api";

const statusPill = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  signed: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
};

function Pill({ status }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusPill[status]}`}>
      {status}
    </span>
  );
}

export default function Proposals() {
  const [proposals, setProposals] = useState([]);
  const [clients, setClients] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ clientId: "", title: "", amount: "", content: "" });

  async function load() {
    const [proposalsRes, clientsRes] = await Promise.all([
      api.get("/proposals"),
      api.get("/clients"),
    ]);
    setProposals(proposalsRes.data);
    setClients(clientsRes.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    await api.post("/proposals", { ...form, amount: parseFloat(form.amount) });
    setForm({ clientId: "", title: "", amount: "", content: "" });
    setShowForm(false);
    load();
  }

  async function setStatus(id, status) {
    await api.patch(`/proposals/${id}/status`, { status });
    load();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Proposals</h1>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {showForm ? "Cancel" : "+ New proposal"}
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
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Amount"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <textarea
            placeholder="Content"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            rows={4}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <button
            type="submit"
            className="self-start rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Save
          </button>
        </form>
      )}

      <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
        {proposals.map((proposal) => (
          <div key={proposal.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="font-medium text-gray-900">{proposal.title}</div>
              <div className="text-sm text-gray-500">
                {proposal.client?.name} — ${proposal.amount.toFixed(2)}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Pill status={proposal.status} />
              {proposal.status === "draft" && (
                <button
                  onClick={() => setStatus(proposal.id, "sent")}
                  className="text-sm font-medium text-brand-700 hover:underline"
                >
                  Mark sent
                </button>
              )}
              {proposal.status === "sent" && (
                <>
                  <button
                    onClick={() => setStatus(proposal.id, "signed")}
                    className="text-sm font-medium text-brand-700 hover:underline"
                  >
                    Mark signed
                  </button>
                  <button
                    onClick={() => setStatus(proposal.id, "declined")}
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    Mark declined
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {proposals.length === 0 && (
          <div className="px-4 py-6 text-sm text-gray-500">No proposals yet.</div>
        )}
      </div>
    </div>
  );
}
