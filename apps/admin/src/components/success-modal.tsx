"use client";

import { CheckCircle2 } from "lucide-react";

export function SuccessModal({
  open,
  title,
  message,
  actionLabel = "Continue",
  onClose,
}: {
  open: boolean;
  title: string;
  message?: string;
  actionLabel?: string;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      style={{ animation: "modal-backdrop-in 0.15s ease-out" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
        style={{ animation: "modal-pop-in 0.2s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
          <CheckCircle2 size={30} />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
        {message && <p className="mt-1.5 text-sm text-slate-500">{message}</p>}
        <button onClick={onClose} className="btn-primary mt-5 w-full justify-center">
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
