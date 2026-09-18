"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { toast } from "@/lib/toast-store";
import type { PaginatedResult } from "@ecommerce-x/shared";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: { firstName: string | null; lastName: string | null; phone: string | null; role: string } | null;
}

const ACTION_COLORS: Record<string, string> = {
  "account.locked": "bg-red-50 text-red-700",
  "user.role_changed": "bg-amber-50 text-amber-700",
  "user.deactivated": "bg-red-50 text-red-700",
  "user.reactivated": "bg-green-50 text-green-700",
  "user.staff_created": "bg-blue-50 text-blue-700",
  "settings.updated": "bg-slate-100 text-slate-600",
  "backup.downloaded": "bg-purple-50 text-purple-700",
  "backup.restored": "bg-red-50 text-red-700",
  "loyalty.manual_adjust": "bg-blue-50 text-blue-700",
};

export default function AuditLogPage() {
  const [result, setResult] = useState<PaginatedResult<AuditEntry> | null>(null);
  const [action, setAction] = useState("");

  async function load() {
    try {
      const qs = new URLSearchParams({ pageSize: "50" });
      if (action) qs.set("action", action);
      setResult(await api.get<PaginatedResult<AuditEntry>>(`/api/audit-log?${qs.toString()}`));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load audit log.");
    }
  }
  useEffect(() => { load(); }, [action]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="mt-1 text-sm text-slate-500">A record of sensitive actions — role changes, settings edits, backups, and account lockouts — so misuse can be traced after the fact.</p>
      </div>

      <input className="input max-w-xs" placeholder="Filter by action…" value={action} onChange={(e) => setAction(e.target.value)} />

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th><th>Details</th><th>IP</th></tr></thead>
          <tbody>
            {result?.items.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap text-slate-500">{new Date(e.createdAt).toLocaleString()}</td>
                <td>
                  {e.user ? (
                    <>
                      <div>{e.user.firstName} {e.user.lastName}</div>
                      <div className="text-xs text-slate-400">{e.user.phone} · {e.user.role}</div>
                    </>
                  ) : (
                    <span className="text-slate-400">System</span>
                  )}
                </td>
                <td><span className={`badge ${ACTION_COLORS[e.action] ?? "bg-slate-100 text-slate-600"}`}>{e.action}</span></td>
                <td className="text-slate-500">{e.entityType}{e.entityId ? ` · ${e.entityId.slice(0, 10)}…` : ""}</td>
                <td className="max-w-xs truncate text-xs text-slate-400" title={e.metadata ? JSON.stringify(e.metadata) : ""}>
                  {e.metadata ? JSON.stringify(e.metadata) : "—"}
                </td>
                <td className="text-xs text-slate-400">{e.ipAddress ?? "—"}</td>
              </tr>
            ))}
            {result?.items.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-slate-400">No audit entries yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
