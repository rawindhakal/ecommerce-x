"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { ApiError } from "@/lib/api";
import { Spinner } from "@/components/spinner";
import { sanitizePhoneInput } from "@ecommerce-x/shared";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await login(phone, password);
      router.push(user.role === "POS_CASHIER" ? "/pos" : "/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Store Admin</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to manage your store</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label">Phone Number</label>
            <input type="tel" inputMode="numeric" autoComplete="tel" required pattern="[0-9]*" maxLength={15} className="input" value={phone} onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))} />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading && <Spinner />} {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
