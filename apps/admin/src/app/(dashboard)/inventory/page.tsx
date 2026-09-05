"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PaginatedResult } from "@ecommerce-x/shared";

interface InventoryRow {
  id: string;
  quantityOnHand: number;
  quantityReserved: number;
  reorderPoint: number;
  variant: { id: string; sku: string; product: { name: string } };
  location: { id: string; name: string };
}

interface Location { id: string; name: string }

export default function InventoryPage() {
  const [result, setResult] = useState<PaginatedResult<InventoryRow> | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [search, setSearch] = useState("");
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState("");

  async function load() {
    const qs = new URLSearchParams({ pageSize: "50" });
    if (locationId) qs.set("locationId", locationId);
    if (lowStock) qs.set("lowStock", "true");
    if (search) qs.set("search", search);
    setResult(await api.get<PaginatedResult<InventoryRow>>(`/api/inventory?${qs.toString()}`));
  }

  useEffect(() => {
    api.get<Location[]>("/api/locations").then(setLocations);
  }, []);
  useEffect(() => { load(); }, [locationId, lowStock]);

  async function submitAdjust(row: InventoryRow) {
    const change = Number(adjustQty);
    if (!change) return;
    await api.post("/api/inventory/adjust", { variantId: row.variant.id, locationId: row.location.id, change, reason: "ADJUSTMENT" });
    setAdjusting(null);
    setAdjustQty("");
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="mt-1 text-sm text-slate-500">
          Stock is tracked per location, but online orders and POS sales draw from one connected pool — a sale in either channel
          reduces the same real total, checked across every location it's held in.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search SKU or product…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        <select className="input w-auto" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">All locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} /> Low stock only
        </label>
      </div>

      {/* Desktop table */}
      <div className="card hidden overflow-x-auto md:block">
        <table className="table-base">
          <thead><tr><th>Product</th><th>SKU</th><th>Location</th><th>On Hand</th><th>Reserved</th><th>Reorder Point</th><th></th></tr></thead>
          <tbody>
            {result?.items.map((row) => (
              <tr key={row.id}>
                <td>{row.variant.product.name}</td>
                <td className="text-slate-500">{row.variant.sku}</td>
                <td className="text-slate-500">{row.location.name}</td>
                <td className={row.quantityOnHand <= row.reorderPoint ? "font-medium text-red-500" : ""}>{row.quantityOnHand}</td>
                <td className="text-slate-500">{row.quantityReserved}</td>
                <td className="text-slate-500">{row.reorderPoint}</td>
                <td>
                  {adjusting === row.id ? (
                    <div className="flex gap-1">
                      <input autoFocus className="input w-20" type="number" placeholder="+/-" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
                      <button onClick={() => submitAdjust(row)} className="btn-primary px-2">Save</button>
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
            <p className="mt-1 text-xs text-slate-500">{row.variant.sku} · {row.location.name}</p>
            <p className="mt-1 text-xs text-slate-400">Reserved {row.quantityReserved} · Reorder at {row.reorderPoint}</p>
            {adjusting === row.id ? (
              <div className="mt-2 flex gap-2">
                <input autoFocus className="input" type="number" placeholder="+/-" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
                <button onClick={() => submitAdjust(row)} className="btn-primary px-3">Save</button>
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
