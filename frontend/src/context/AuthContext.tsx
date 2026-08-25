import { createContext, useContext, useState, type ReactNode } from "react";
import api from "@/lib/api";

export interface OrgMembership {
  id: string;
  name: string;
  slug: string;
  role: "OWNER" | "ADMIN" | "ACCOUNTANT" | "MEMBER";
}

export type PlatformRole = "SUPER_ADMIN" | "PLATFORM_ADMIN" | "SUPPORT_ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  platformRole?: PlatformRole | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  organizations: OrgMembership[];
  activeOrgId: string | null;
  activeOrg: OrgMembership | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, organizationName: string) => Promise<void>;
  logout: () => void;
  switchOrganization: (orgId: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredOrgs(): OrgMembership[] {
  const raw = localStorage.getItem("if_orgs");
  return raw ? JSON.parse(raw) : [];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem("if_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [organizations, setOrganizations] = useState<OrgMembership[]>(readStoredOrgs);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(() => localStorage.getItem("if_org_id"));

  function persist(token: string, user: AuthUser, organizations: OrgMembership[]) {
    localStorage.setItem("if_token", token);
    localStorage.setItem("if_user", JSON.stringify(user));
    localStorage.setItem("if_orgs", JSON.stringify(organizations));
    const orgId = organizations[0]?.id ?? null;
    if (orgId) localStorage.setItem("if_org_id", orgId);
    setUser(user);
    setOrganizations(organizations);
    setActiveOrgId(orgId);
  }

  async function login(email: string, password: string) {
    const { data } = await api.post("/auth/login", { email, password });
    persist(data.token, data.user, data.organizations);
  }

  async function register(name: string, email: string, password: string, organizationName: string) {
    const { data } = await api.post("/auth/register", { name, email, password, organizationName });
    persist(data.token, data.user, data.organizations);
  }

  function logout() {
    localStorage.removeItem("if_token");
    localStorage.removeItem("if_user");
    localStorage.removeItem("if_orgs");
    localStorage.removeItem("if_org_id");
    setUser(null);
    setOrganizations([]);
    setActiveOrgId(null);
  }

  function switchOrganization(orgId: string) {
    localStorage.setItem("if_org_id", orgId);
    setActiveOrgId(orgId);
  }

  const activeOrg = organizations.find((o) => o.id === activeOrgId) ?? null;

  return (
    <AuthContext.Provider
      value={{ user, organizations, activeOrgId, activeOrg, login, register, logout, switchOrganization }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
