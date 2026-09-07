"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { PaginatedResult } from "@ecommerce-x/shared";

interface UserRow {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  loyaltyPoints: number;
  isActive: boolean;
  createdAt: string;
}

export default function CustomersPage() {
  const { user: currentUser } = useAuthStore();
  const [result, setResult] = useState<PaginatedResult<UserRow> | null>(null);
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staffForm, setStaffForm] = useState({ phone: "", email: "", password: "", firstName: "", lastName: "", role: "STAFF" });

  async function load() {
    const qs = new URLSearchParams({ pageSize: "30" });
    if (role) qs.set("role", role);
    if (search) qs.set("search", search);
    setResult(await api.get<PaginatedResult<UserRow>>(`/api/users?${qs.toString()}`));
  }

  useEffect(() => { load(); }, [role]);

  async function createStaff(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/api/users/staff", staffForm);
    setStaffForm({ phone: "", email: "", password: "", firstName: "", lastName: "", role: "STAFF" });
    setShowStaffForm(false);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customers &amp; Staff</h1>
        <button className="btn-primary" onClick={() => setShowStaffForm((v) => !v)}><Plus size={16} /> New Staff Account</button>
      </div>

      {showStaffForm && (
        <form onSubmit={createStaff} className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <input required placeholder="First name" className="input" value={staffForm.firstName} onChange={(e) => setStaffForm({ ...staffForm, firstName: e.target.value })} />
          <input placeholder="Last name" className="input" value={staffForm.lastName} onChange={(e) => setStaffForm({ ...staffForm, lastName: e.target.value })} />
          <input required type="tel" placeholder="Phone Number" className="input" value={staffForm.phone} onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })} />
          <input type="email" placeholder="Email (optional)" className="input" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} />
          <div>
            <input required type="password" placeholder="Password" className="input" value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} />
            <p className="mt-1 text-xs text-slate-400">At least 8 characters, with a letter and a number.</p>
          </div>
          <select className="input" value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}>
            <option value="STAFF">Staff</option>
            <option value="POS_CASHIER">POS Cashier</option>
            <option value="ADMIN">Admin</option>
            {currentUser?.role === "SUPERADMIN" && <option value="SUPERADMIN">Super Admin</option>}
          </select>
          <button type="submit" className="btn-primary sm:col-span-2">Create Account</button>
        </form>
      )}

      <div className="flex gap-3">
        <div className="relative max-w-sm flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search by phone, name…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        </div>
        <select className="input w-auto" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All</option>
          <option value="CUSTOMER">Customers</option>
          <option value="STAFF">Staff</option>
          <option value="POS_CASHIER">POS Cashiers</option>
          <option value="ADMIN">Admins</option>
          <option value="SUPERADMIN">Super Admins</option>
        </select>
      </div>

      {/* Desktop table */}
      <div className="card hidden overflow-x-auto md:block">
        <table className="table-base">
          <thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>Loyalty Points</th><th>Joined</th></tr></thead>
          <tbody>
            {result?.items.map((u) => (
              <tr key={u.id}>
                <td><Link href={`/customers/${u.id}`} className="font-medium text-brand-600 hover:underline">{u.firstName} {u.lastName}</Link></td>
                <td className="text-slate-500">{u.phone ?? u.email}</td>
                <td><span className="badge bg-slate-100 text-slate-600">{u.role}</span></td>
                <td>{u.loyaltyPoints}</td>
                <td className="text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="space-y-3 md:hidden">
        {result?.items.map((u) => (
          <Link key={u.id} href={`/customers/${u.id}`} className="card block p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-brand-600">{u.firstName} {u.lastName}</span>
              <span className="badge bg-slate-100 text-slate-600">{u.role}</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{u.phone ?? u.email}</p>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
              <span>{u.loyaltyPoints} loyalty pts</span>
              <span>Joined {new Date(u.createdAt).toLocaleDateString()}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
