import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useSeo } from "@/hooks/useSeo";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";

export default function Login() {
  useSeo({
    title: "Sign In",
    description: "Sign in to your InvoiceFlow account to manage invoices, quotes, and payments.",
    path: "/login",
    noindex: true,
  });
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const successMessage = (location.state as { message?: string } | null)?.message;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/app");
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
          <h1 className="mb-1 text-xl font-semibold text-fg">Welcome back</h1>
          <p className="mb-6 text-sm text-fg-secondary">Sign in to your account</p>

          {successMessage && (
            <div className="mb-4 rounded-lg bg-success-bg px-3 py-2 text-sm text-success">{successMessage}</div>
          )}
          {error && (
            <div className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="mt-2">
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-fg-secondary">
          Don't have an account?{" "}
          <Link to="/register" className="font-medium text-brand-600 hover:text-brand-700">
            Start for free
          </Link>
        </p>
      </div>
    </div>
  );
}
