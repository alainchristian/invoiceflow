import { useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { useSeo } from "@/hooks/useSeo";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";

export default function ForgotPassword() {
  useSeo({
    title: "Forgot Password",
    description: "Reset the password for your InvoiceFlow account.",
    path: "/forgot-password",
    noindex: true,
  });
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setMessage(data.message);
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
          <h1 className="mb-1 text-xl font-semibold text-fg">Forgot your password?</h1>
          <p className="mb-6 text-sm text-fg-secondary">
            Enter your email and we'll send you a link to reset it.
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{error}</div>
          )}
          {message && (
            <div className="mb-4 rounded-lg bg-success-bg px-3 py-2 text-sm text-success">{message}</div>
          )}

          {!message && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <Button type="submit" disabled={loading} className="mt-2">
                {loading ? "Sending..." : "Send reset link"}
              </Button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-fg-secondary">
          Remembered your password?{" "}
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
