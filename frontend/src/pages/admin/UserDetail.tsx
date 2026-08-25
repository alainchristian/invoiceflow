import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useAdminUser } from "@/hooks/useAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  PLATFORM_ADMIN: "Platform Admin",
  SUPPORT_ADMIN: "Support Admin",
};

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: user, isLoading } = useAdminUser(id);

  if (isLoading || !user) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div>
      <Link to="/admin/users" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-secondary hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Back to users
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-fg">{user.name}</h1>
        {user.platformRole && (
          <Badge variant="brand">
            <ShieldCheck className="mr-1 h-3 w-3" /> {ROLE_LABEL[user.platformRole]}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-border py-1.5">
              <span className="text-fg-muted">Email</span>
              <span className="text-fg">{user.email}</span>
            </div>
            <div className="flex justify-between border-b border-border py-1.5">
              <span className="text-fg-muted">Joined</span>
              <span className="text-fg">{formatDate(user.createdAt)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-fg-muted">Last active</span>
              <span className="text-fg">{user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            {user.memberships.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="No organizations" description="This user doesn't belong to any tenant." className="py-8" />
            ) : (
              <div className="divide-y divide-border">
                {user.memberships.map((m) => (
                  <Link
                    key={m.id}
                    to={`/admin/tenants/${m.organization.id}`}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0 hover:opacity-80"
                  >
                    <div>
                      <p className="text-sm font-medium text-brand-600">{m.organization.name}</p>
                      <p className="text-xs text-fg-muted">Joined {formatDate(m.createdAt)}</p>
                    </div>
                    <Badge variant="neutral" className="capitalize">
                      {m.role.toLowerCase()}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
