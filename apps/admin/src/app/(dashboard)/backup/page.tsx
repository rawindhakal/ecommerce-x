"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Upload, AlertTriangle, DatabaseBackup } from "lucide-react";
import { API_URL, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { toast } from "@/lib/toast-store";
import { Spinner } from "@/components/spinner";

interface SafetyBackup {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BackupPage() {
  const { user } = useAuthStore();
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [safetyBackups, setSafetyBackups] = useState<SafetyBackup[]>([]);
  const [confirmText, setConfirmText] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadSafetyBackups() {
    try {
      const res = await fetch(`${API_URL}/api/backup/safety-backups`, { credentials: "include" });
      if (res.ok) setSafetyBackups(await res.json());
    } catch {
      // non-critical — the page still works without this list
    }
  }
  useEffect(() => {
    loadSafetyBackups();
  }, []);

  if (user && user.role !== "SUPERADMIN") {
    return (
      <div className="card p-6 text-sm text-slate-500">
        Only a Super Admin can access database backup and restore.
      </div>
    );
  }

  async function downloadBackup() {
    setError(null);
    setDownloading(true);
    try {
      const res = await fetch(`${API_URL}/api/backup/download`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(res.status, body.message ?? "Backup failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] ?? "backup.dump";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded");
    } catch (err: any) {
      const message = err.message ?? "Backup failed";
      setError(message);
      toast.error(message);
    } finally {
      setDownloading(false);
    }
  }

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setConfirmText("");
      setResult(null);
      setError(null);
    }
  }

  async function confirmRestore() {
    if (!pendingFile || confirmText !== "RESTORE") return;
    setError(null);
    setResult(null);
    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append("file", pendingFile);
      const res = await fetch(`${API_URL}/api/backup/restore`, { method: "POST", body: formData, credentials: "include" });
      const body = await res.json();
      if (!res.ok) throw new ApiError(res.status, body.message ?? "Restore failed");
      setResult(`Restore complete. A safety backup of the previous data was saved as "${body.safetyBackup}".`);
      toast.success("Restore complete");
      setPendingFile(null);
      setConfirmText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadSafetyBackups();
    } catch (err: any) {
      const message = err.message ?? "Restore failed";
      setError(message);
      toast.error(message);
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Backup &amp; Restore</h1>
        <p className="mt-1 text-sm text-slate-500">Full database backup — every product, order, customer, and setting. Restricted to Super Admin.</p>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-3">
          <DatabaseBackup className="text-brand-600" size={22} />
          <div>
            <h2 className="text-sm font-semibold">Download a Backup</h2>
            <p className="text-xs text-slate-400">Generates a fresh backup right now and downloads it to your device.</p>
          </div>
        </div>
        <button onClick={downloadBackup} disabled={downloading} className="btn-primary mt-4">
          {downloading ? <Spinner /> : <Download size={16} />} {downloading ? "Preparing backup…" : "Download Backup"}
        </button>
      </div>

      <div className="card border border-red-100 p-5">
        <div className="flex items-center gap-3">
          <AlertTriangle className="text-red-500" size={22} />
          <div>
            <h2 className="text-sm font-semibold">Restore from Backup</h2>
            <p className="text-xs text-slate-400">
              Replaces <span className="font-medium text-red-500">all current data</span> with the contents of the uploaded backup file. This cannot be undone from the UI —
              a safety copy of the current data is taken automatically first, but only use this if you're certain.
            </p>
          </div>
        </div>

        <label className="btn-outline mt-4 w-fit cursor-pointer">
          <Upload size={14} /> Choose Backup File
          <input ref={fileInputRef} type="file" accept=".dump" className="hidden" onChange={pickFile} />
        </label>

        {pendingFile && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">
              About to restore from <span className="font-mono">{pendingFile.name}</span> ({formatBytes(pendingFile.size)}). Type <span className="font-mono font-bold">RESTORE</span> below to confirm.
            </p>
            <input
              className="input mt-2"
              placeholder="Type RESTORE to confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={confirmRestore}
                disabled={confirmText !== "RESTORE" || restoring}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-40"
              >
                {restoring && <Spinner />} {restoring ? "Restoring…" : "Restore Now"}
              </button>
              <button
                onClick={() => {
                  setPendingFile(null);
                  setConfirmText("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="btn-outline"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {result && <p className="mt-4 text-sm text-green-700">{result}</p>}
      </div>

      <div className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Automatic Safety Backups</h2>
        <p className="mb-4 text-xs text-slate-400">Taken automatically right before each restore, so a bad restore can be undone. The most recent 5 are kept.</p>
        {safetyBackups.length === 0 ? (
          <p className="text-sm text-slate-400">None yet — one is created the first time you restore.</p>
        ) : (
          <ul className="space-y-2">
            {safetyBackups.map((b) => (
              <li key={b.filename} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div>
                  <p className="font-mono text-xs">{b.filename}</p>
                  <p className="text-xs text-slate-400">{new Date(b.createdAt).toLocaleString()} · {formatBytes(b.sizeBytes)}</p>
                </div>
                <a href={`${API_URL}/api/backup/safety-backups/${b.filename}`} className="text-brand-600 hover:underline" target="_blank" rel="noreferrer">
                  <Download size={16} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
