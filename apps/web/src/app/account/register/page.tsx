"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore, ApiError } from "@/lib/auth-store";
import { sanitizePhoneInput } from "@ecommerce-x/shared";

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await register(form);
      router.push("/account");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-x flex justify-center py-20">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl">Create Account</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">First Name</label>
              <input required className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Phone Number</label>
            <input type="tel" inputMode="numeric" autoComplete="tel" required minLength={7} maxLength={15} pattern="[0-9]*" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: sanitizePhoneInput(e.target.value) })} />
          </div>
          <div>
            <label className="label">Email (optional)</label>
            <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" minLength={8} required className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <p className="mt-1 text-xs text-ink/40">At least 8 characters, with a letter and a number.</p>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? "Creating…" : "Create Account"}</button>
        </form>
        <p className="mt-4 text-sm text-ink/60">
          Already have an account? <Link href="/account/login" className="text-brand underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
