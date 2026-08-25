import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { useSeo } from "@/hooks/useSeo";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";

export default function ResetPassword() {
  useSeo({
    title: "Reset Password",
    description: "Choose a new password for your InvoiceFlow account.",
    path: "/reset-password",
    noindex: true,
  });
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword });
      navigate("/login", { state: { message: "Password updated. You can now log in." } });
    } catch (err: any) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">
            I
          </div>
          <span className="text-lg font-semibold text-fg">InvoiceFlow</span>
        </Link>

        <div className="rounded-xl border border-border bg-surface p-8 shadow-sm">
          <h1 className="mb-1 text-xl font-semibold text-fg">Reset your password</h1>
          <p className="mb-6 text-sm text-fg-secondary">Choose a new password for your account.</p>

          {!token && (
            <div className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
              This reset link is missing its token. Request a new one below.
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading || !token} className="mt-2">
              {loading ? "Resetting..." : "Reset password"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-fg-secondary">
          <Link to="/forgot-password" className="font-medium text-brand-600 hover:text-brand-700">
            Request a new link
          </Link>
        </p>
      </div>
    </div>
  );
}
