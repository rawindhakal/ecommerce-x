"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";

export interface DateRange {
  from: string; // ISO date (yyyy-mm-dd)
  to: string;
}

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "month", label: "This Month" },
  { key: "custom", label: "Custom" },
] as const;

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function presetRange(key: (typeof PRESETS)[number]["key"]): DateRange {
  const now = new Date();
  const today = toISODate(now);
  switch (key) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: toISODate(new Date(now.getTime() - 6 * 86400000)), to: today };
    case "30d":
      return { from: toISODate(new Date(now.getTime() - 29 * 86400000)), to: today };
    case "month":
      return { from: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    default:
      return { from: today, to: today };
  }
}

export function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (range: DateRange) => void }) {
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["key"]>("30d");
  const [showCustom, setShowCustom] = useState(false);

  function selectPreset(key: (typeof PRESETS)[number]["key"]) {
    setPreset(key);
    if (key === "custom") {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    onChange(presetRange(key));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Calendar size={16} className="hidden text-slate-400 sm:block" />
      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => selectPreset(p.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              preset === p.key ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {showCustom && (
        <div className="flex items-center gap-2">
          <input type="date" className="input w-auto" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          <span className="text-slate-400">–</span>
          <input type="date" className="input w-auto" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </div>
      )}
    </div>
  );
}
