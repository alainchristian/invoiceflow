import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";

const statusPill = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  signed: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
};

function Pill({ status }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusPill[status] || "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

function NewProjectForm({ clientId, onCreated }) {
  const [title, setTitle] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    await api.post("/projects", { clientId, title });
    setTitle("");
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
      <input
        type="text"
        placeholder="New project title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Add
      </button>
    </form>
  );
}

function NewTaskForm({ projectId, onCreated }) {
  const [title, setTitle] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    await api.post(`/projects/${projectId}/tasks`, { title });
    setTitle("");
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex gap-2">
      <input
        type="text"
        placeholder="New task"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-md bg-gray-100 px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200"
      >
        Add task
      </button>
    </form>
  );
}

export default function ClientDetail() {
  const { id } = useParams();
  const [client, setClient] = useState(null);

  async function load() {
    const { data } = await api.get(`/clients/${id}`);
    setClient(data);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function toggleTask(taskId, done) {
    await api.patch(`/projects/tasks/${taskId}`, { done: !done });
    load();
  }

  if (!client) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
      <p className="mb-6 text-sm text-gray-500">{client.company || client.email}</p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Projects</h2>
          <NewProjectForm clientId={id} onCreated={load} />
          <div className="flex flex-col gap-3">
            {client.projects.map((project) => (
              <div key={project.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-gray-900">{project.title}</span>
                  <Pill status={project.status} />
                </div>
                <ul className="flex flex-col gap-1">
                  {project.tasks.map((task) => (
                    <li key={task.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={() => toggleTask(task.id, task.done)}
                      />
                      <span className={task.done ? "text-gray-400 line-through" : "text-gray-700"}>
                        {task.title}
                      </span>
                    </li>
                  ))}
                </ul>
                <NewTaskForm projectId={project.id} onCreated={load} />
              </div>
            ))}
            {client.projects.length === 0 && (
              <div className="text-sm text-gray-500">No projects yet.</div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Proposals</h2>
            <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
              {client.proposals.map((proposal) => (
                <div key={proposal.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-900">{proposal.title}</span>
                  <Pill status={proposal.status} />
                </div>
              ))}
              {client.proposals.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-500">No proposals yet.</div>
              )}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Invoices</h2>
            <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
              {client.invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-900">
                    #{invoice.number} — ${invoice.amount.toFixed(2)}
                  </span>
                  <Pill status={invoice.status} />
                </div>
              ))}
              {client.invoices.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-500">No invoices yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
