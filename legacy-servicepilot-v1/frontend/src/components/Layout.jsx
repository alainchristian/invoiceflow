import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/clients", label: "Clients" },
  { to: "/proposals", label: "Proposals" },
  { to: "/invoices", label: "Invoices" },
  { to: "/settings", label: "Settings" },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col justify-between border-r border-gray-200 bg-white">
        <div>
          <div className="px-4 py-5 text-lg font-bold text-brand-700">ServicePilot</div>
          <nav className="flex flex-col gap-1 px-2">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium ${
                    isActive
                      ? "bg-brand-100 text-brand-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="border-t border-gray-200 px-4 py-4">
          <div className="mb-2 text-sm text-gray-700">{user?.name}</div>
          <button
            onClick={logout}
            className="text-sm font-medium text-gray-500 hover:text-brand-700"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
