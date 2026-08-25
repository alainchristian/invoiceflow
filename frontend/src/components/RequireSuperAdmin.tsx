import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

// Nested inside RequireAdmin's route tree -- narrows Administrators/Settings
// down to SUPER_ADMIN only. The real gate is the backend's requirePlatformRole;
// this is UX (don't show a page whose actions will all 403 anyway).
export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.platformRole !== "SUPER_ADMIN") return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
