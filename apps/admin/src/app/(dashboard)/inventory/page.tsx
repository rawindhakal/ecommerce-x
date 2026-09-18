"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Spinner } from "@/components/spinner";
import { toast } from "@/lib/toast-store";
import type { PaginatedResult } from "@ecommerce-x/shared";

interface InventoryRow {
  id: string;
  quantityOnHand: number;
  quantityReserved: number;
  reorderPoint: number;
  variant: { id: string; sku: string; product: { name: string } };
}

export default function InventoryPage() {
  const [result, setResult] = useState<PaginatedResult<InventoryRow> | null>(null);
  const [lowStock, setLowStock] = useState(false);
  const [search, setSearch] = useState("");
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const qs = new URLSearchParams({ pageSize: "50" });
      if (lowStock) qs.set("lowStock", "true");
      if (search) qs.set("search", search);
      setResult(await api.get<PaginatedResult<InventoryRow>>(`/api/inventory?${qs.toString()}`));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load inventory.");
    }
  }

  useEffect(() => { load(); }, [lowStock]);

  async function submitAdjust(row: InventoryRow) {
    const change = Number(adjustQty);
    if (!change) {
      toast.error("Enter a non-zero adjustment amount.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/inventory/adjust", { variantId: row.variant.id, change, reason: "ADJUSTMENT" });
      toast.success("Stock adjusted");
      setAdjusting(null);
      setAdjustQty("");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to adjust stock. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="mt-1 text-sm text-slate-500">
          Online orders and POS sales draw from the same stock count — a sale in either channel reduces the same real total.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search SKU or product…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} /> Low stock only
        </label>
      </div>

      {/* Desktop table */}
      <div className="card hidden overflow-x-auto md:block">
        <table className="table-base">
          <thead><tr><th>Product</th><th>SKU</th><th>On Hand</th><th>Reserved</th><th>Reorder Point</th><th></th></tr></thead>
          <tbody>
            {result?.items.map((row) => (
              <tr key={row.id}>
                <td>{row.variant.product.name}</td>
                <td className="text-slate-500">{row.variant.sku}</td>
                <td className={row.quantityOnHand <= row.reorderPoint ? "font-medium text-red-500" : ""}>{row.quantityOnHand}</td>
                <td className="text-slate-500">{row.quantityReserved}</td>
                <td className="text-slate-500">{row.reorderPoint}</td>
                <td>
                  {adjusting === row.id ? (
                    <div className="flex gap-1">
                      <input autoFocus className="input w-20" type="number" placeholder="+/-" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
                      <button onClick={() => submitAdjust(row)} disabled={saving} className="btn-primary px-2">{saving ? <Spinner /> : "Save"}</button>
                    </div>
                  ) : (
                    <button onClick={() => setAdjusting(row.id)} className="btn-outline px-2 py-1 text-xs">Adjust</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="space-y-3 md:hidden">
        {result?.items.map((row) => (
          <div key={row.id} className="card p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{row.variant.product.name}</span>
              <span className={row.quantityOnHand <= row.reorderPoint ? "font-semibold text-red-500" : "font-semibold"}>{row.quantityOnHand}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{row.variant.sku}</p>
            <p className="mt-1 text-xs text-slate-400">Reserved {row.quantityReserved} · Reorder at {row.reorderPoint}</p>
            {adjusting === row.id ? (
              <div className="mt-2 flex gap-2">
                <input autoFocus className="input" type="number" placeholder="+/-" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
                <button onClick={() => submitAdjust(row)} disabled={saving} className="btn-primary px-3">{saving ? <Spinner /> : "Save"}</button>
              </div>
            ) : (
              <button onClick={() => setAdjusting(row.id)} className="btn-outline mt-2 w-full py-2 text-sm">Adjust Stock</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
