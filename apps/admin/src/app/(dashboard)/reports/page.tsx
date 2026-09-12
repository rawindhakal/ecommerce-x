"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Printer, Users, Receipt, Package } from "lucide-react";
import { api } from "@/lib/api";
import { formatNpr } from "@/lib/format";
import { DateRangeFilter, presetRange, type DateRange } from "@/components/date-range-filter";

type Tab = "overview" | "products" | "payments" | "customers" | "inventory" | "pos" | "zreport";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "products", label: "Products & Categories" },
  { key: "payments", label: "Payments & Coupons" },
  { key: "customers", label: "Customers" },
  { key: "inventory", label: "Inventory" },
  { key: "pos", label: "POS Sessions" },
  { key: "zreport", label: "Z-Report" },
];

const CHART_COLORS = ["#C2185B", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6"];

export default function ReportsPage() {
  const [range, setRange] = useState<DateRange>(() => presetRange("30d"));
  const [channel, setChannel] = useState<string>("");
  const [tab, setTab] = useState<Tab>("overview");

  const qs = `from=${range.from}&to=${range.to}${channel ? `&channel=${channel}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <div className="flex flex-wrap items-center gap-3">
          <select className="input w-auto" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">All Channels</option>
            <option value="ONLINE">Online</option>
            <option value="POS">POS</option>
          </select>
          <DateRangeFilter value={range} onChange={setRange} />
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${tab === t.key ? "border-brand-500 text-brand-600" : "border-transparent text-slate-500"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab qs={qs} />}
      {tab === "products" && <ProductsTab qs={qs} />}
      {tab === "payments" && <PaymentsTab qs={qs} />}
      {tab === "customers" && <CustomersTab qs={qs} />}
      {tab === "inventory" && <InventoryTab />}
      {tab === "pos" && <PosSessionsTab range={range} />}
      {tab === "zreport" && <ZReportTab />}
    </div>
  );
}

function StatCard({ label, value, changePct }: { label: string; value: string; changePct?: number | null }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {typeof changePct === "number" && (
        <p className={`mt-1 flex items-center gap-1 text-xs ${changePct >= 0 ? "text-green-600" : "text-red-500"}`}>
          {changePct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(changePct).toFixed(1)}% vs previous period
        </p>
      )}
    </div>
  );
}

function OverviewTab({ qs }: { qs: string }) {
  const [overview, setOverview] = useState<any>(null);
  const [trend, setTrend] = useState<any[]>([]);
  const [byChannel, setByChannel] = useState<any[]>([]);

  useEffect(() => {
    api.get(`/api/reports/overview?${qs}`).then(setOverview);
    api.get<any[]>(`/api/reports/sales-trend?${qs}`).then(setTrend);
    api.get<any[]>(`/api/reports/by-channel?${qs.split("&channel")[0]}`).then(setByChannel);
  }, [qs]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Revenue" value={formatNpr(overview?.revenue ?? 0)} changePct={overview?.revenueChangePct} />
        <StatCard label="Orders" value={String(overview?.orders ?? 0)} changePct={overview?.ordersChangePct} />
        <StatCard label="Avg Order Value" value={formatNpr(overview?.avgOrderValue ?? 0)} />
        <StatCard label="Units Sold" value={String(overview?.unitsSold ?? 0)} />
        <StatCard label="Discounts Given" value={formatNpr(overview?.discountTotal ?? 0)} />
        <StatCard label="Shipping Collected" value={formatNpr(overview?.shippingTotal ?? 0)} />
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold">Sales Trend</h2>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatNpr(v)} />
              <Line type="monotone" dataKey="revenue" stroke="#C2185B" strokeWidth={2} dot={false} name="Revenue" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card overflow-x-auto p-5">
        <h2 className="mb-4 text-sm font-semibold">Sales by Channel</h2>
        <table className="table-base">
          <thead><tr><th>Channel</th><th>Orders</th><th>Revenue</th></tr></thead>
          <tbody>
            {byChannel.map((c) => (
              <tr key={c.channel}><td>{c.channel}</td><td>{c.orders}</td><td>{formatNpr(c.revenue)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductsTab({ qs }: { qs: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    api.get<any[]>(`/api/reports/top-products?${qs}`).then(setProducts);
    api.get<any[]>(`/api/reports/by-category?${qs}`).then(setCategories);
  }, [qs]);

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold">Top Products by Revenue</h2>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={products.slice(0, 8)} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
              <Tooltip formatter={(v: number) => formatNpr(v)} />
              <Bar dataKey="revenue" fill="#C2185B" radius={[0, 4, 4, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="table-base mt-4">
          <thead><tr><th>Product</th><th>Units Sold</th><th>Revenue</th></tr></thead>
          <tbody>
            {products.map((p) => <tr key={p.productId}><td>{p.name}</td><td>{p.unitsSold}</td><td>{formatNpr(p.revenue)}</td></tr>)}
          </tbody>
        </table>
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold">Sales by Category</h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categories}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="category" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatNpr(v)} />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {categories.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function PaymentsTab({ qs }: { qs: string }) {
  const [methods, setMethods] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);

  useEffect(() => {
    api.get<any[]>(`/api/reports/payment-methods?${qs}`).then(setMethods);
    api.get<any[]>(`/api/reports/coupons?${qs}`).then(setCoupons);
  }, [qs]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="card overflow-x-auto p-5">
        <h2 className="mb-4 text-sm font-semibold">Revenue by Payment Method</h2>
        <table className="table-base">
          <thead><tr><th>Method</th><th>Orders</th><th>Revenue</th></tr></thead>
          <tbody>
            {methods.map((m) => <tr key={m.gateway}><td>{m.gateway}</td><td>{m.count}</td><td>{formatNpr(m.revenue)}</td></tr>)}
            {methods.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-slate-400">No payments in this range</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto p-5">
        <h2 className="mb-4 text-sm font-semibold">Coupon Usage</h2>
        <table className="table-base">
          <thead><tr><th>Code</th><th>Uses</th><th>Discount Given</th></tr></thead>
          <tbody>
            {coupons.map((c) => <tr key={c.code}><td className="font-mono">{c.code}</td><td>{c.uses}</td><td>{formatNpr(c.discountGiven)}</td></tr>)}
            {coupons.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-slate-400">No coupons used in this range</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomersTab({ qs }: { qs: string }) {
  const [customers, setCustomers] = useState<any[]>([]);
  useEffect(() => {
    api.get<any[]>(`/api/reports/top-customers?${qs}`).then(setCustomers);
  }, [qs]);

  return (
    <div className="card overflow-x-auto p-5">
      <h2 className="mb-4 text-sm font-semibold">Top Customers by Spend</h2>
      <table className="table-base">
        <thead><tr><th>Customer</th><th>Phone</th><th>Orders</th><th>Total Spent</th><th>GlowPoints</th></tr></thead>
        <tbody>
          {customers.map((c, i) => (
            <tr key={i}>
              <td>{c.user?.firstName} {c.user?.lastName}</td>
              <td className="text-slate-500">{c.user?.phone ?? "—"}</td>
              <td>{c.orders}</td>
              <td>{formatNpr(c.totalSpent)}</td>
              <td>{c.user?.loyaltyPoints ?? 0}</td>
            </tr>
          ))}
          {customers.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-400">No customer orders in this range</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function InventoryTab() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    api.get("/api/reports/inventory").then(setData);
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Stock Value (cost)" value={formatNpr(data?.stockValue ?? 0)} />
        <StatCard label="Total Units on Hand" value={String(data?.totalUnits ?? 0)} />
        <StatCard label="Low Stock Items" value={String(data?.lowStockCount ?? 0)} />
      </div>
      <div className="card overflow-x-auto p-5">
        <h2 className="mb-4 text-sm font-semibold">Low Stock</h2>
        <table className="table-base">
          <thead><tr><th>Product</th><th>SKU</th><th>On Hand</th><th>Reorder Point</th></tr></thead>
          <tbody>
            {data?.lowStock.map((r: any, i: number) => (
              <tr key={i}><td>{r.product}</td><td className="text-slate-500">{r.sku}</td><td className="font-medium text-red-500">{r.quantityOnHand}</td><td>{r.reorderPoint}</td></tr>
            ))}
            {data?.lowStock.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-slate-400">Nothing low on stock</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PosSessionsTab({ range }: { range: DateRange }) {
  const [sessions, setSessions] = useState<any[]>([]);
  useEffect(() => {
    api.get<any[]>(`/api/reports/pos-sessions?from=${range.from}&to=${range.to}`).then(setSessions);
  }, [range]);

  return (
    <div className="card overflow-x-auto p-5">
      <h2 className="mb-4 text-sm font-semibold">POS Sessions</h2>
      <table className="table-base">
        <thead><tr><th>Cashier</th><th>Opened</th><th>Closed</th><th>Opening</th><th>Expected</th><th>Counted</th><th>Variance</th></tr></thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id}>
              <td>{s.cashier}</td>
              <td className="text-slate-500">{new Date(s.openedAt).toLocaleString()}</td>
              <td className="text-slate-500">{s.closedAt ? new Date(s.closedAt).toLocaleString() : "Open"}</td>
              <td>{formatNpr(s.openingBalance)}</td>
              <td>{s.expectedBalance !== null ? formatNpr(s.expectedBalance) : "—"}</td>
              <td>{s.closingBalance !== null ? formatNpr(s.closingBalance) : "—"}</td>
              <td className={s.variance == null ? "" : s.variance === 0 ? "text-green-600" : s.variance > 0 ? "text-blue-600" : "text-red-500"}>
                {s.variance !== null ? formatNpr(s.variance) : "—"}
              </td>
            </tr>
          ))}
          {sessions.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-slate-400">No POS sessions in this range</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

interface ZReportData {
  date: string;
  totalSales: number;
  orderCount: number;
  customerCount: number;
  unitsSold: number;
  byChannel: { channel: string; revenue: number; orders: number }[];
  byPaymentMethod: { gateway: string; revenue: number; count: number }[];
  itemsSold: { productId: string; name: string; quantitySold: number; revenue: number }[];
  customers: { key: string; name: string; phone: string | null; email: string | null; isGuest: boolean; orders: number; amountSpent: number }[];
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function ZReportTab() {
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState<ZReportData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get<ZReportData>(`/api/reports/z-report?date=${date}`).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [date]);

  return (
    <div id="z-report" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input type="date" className="input w-auto" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          <button onClick={() => setDate(todayISO())} className="btn-outline">Today</button>
        </div>
        <button onClick={() => window.print()} className="btn-outline"><Printer size={14} /> Print Report</button>
      </div>

      {loading || !data ? (
        <p className="py-16 text-center text-sm text-slate-400">Loading day-end report…</p>
      ) : (
        <>
          <div className="card bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white">
            <p className="text-sm text-white/70">
              Z-Report — {new Date(`${data.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
            <p className="mt-1 text-4xl font-bold">{formatNpr(data.totalSales)}</p>
            <p className="mt-1 text-sm text-white/70">Total sales across all channels</p>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Orders" value={String(data.orderCount)} />
            <StatCard label="Customers Served" value={String(data.customerCount)} />
            <StatCard label="Units Sold" value={String(data.unitsSold)} />
            <StatCard label="Avg Order Value" value={formatNpr(data.orderCount ? data.totalSales / data.orderCount : 0)} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card overflow-x-auto p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Receipt size={15} /> Sales by Channel</h2>
              <table className="table-base">
                <thead><tr><th>Channel</th><th>Orders</th><th>Revenue</th></tr></thead>
                <tbody>
                  {data.byChannel.map((c) => <tr key={c.channel}><td>{c.channel}</td><td>{c.orders}</td><td>{formatNpr(c.revenue)}</td></tr>)}
                  {data.byChannel.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-slate-400">No sales this day</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="card overflow-x-auto p-5">
              <h2 className="mb-4 text-sm font-semibold">Sales by Payment Method</h2>
              <table className="table-base">
                <thead><tr><th>Method</th><th>Count</th><th>Revenue</th></tr></thead>
                <tbody>
                  {data.byPaymentMethod.map((m) => <tr key={m.gateway}><td>{m.gateway}</td><td>{m.count}</td><td>{formatNpr(m.revenue)}</td></tr>)}
                  {data.byPaymentMethod.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-slate-400">No payments this day</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card overflow-x-auto p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Package size={15} /> Items Sold</h2>
            <table className="table-base">
              <thead><tr><th>Product</th><th>Qty Sold</th><th>Revenue</th></tr></thead>
              <tbody>
                {data.itemsSold.map((i) => <tr key={i.productId}><td>{i.name}</td><td>{i.quantitySold}</td><td>{formatNpr(i.revenue)}</td></tr>)}
                {data.itemsSold.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-slate-400">No items sold this day</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="card overflow-x-auto p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Users size={15} /> Sales by Customer</h2>
            <table className="table-base">
              <thead><tr><th>Customer</th><th>Contact</th><th>Orders</th><th>Amount Spent</th></tr></thead>
              <tbody>
                {data.customers.map((c) => (
                  <tr key={c.key}>
                    <td>{c.name}{c.isGuest && <span className="badge ml-1.5 bg-slate-100 text-slate-500">Guest</span>}</td>
                    <td className="text-slate-500">{c.phone ?? c.email ?? "—"}</td>
                    <td>{c.orders}</td>
                    <td>{formatNpr(c.amountSpent)}</td>
                  </tr>
                ))}
                {data.customers.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-slate-400">No customers this day</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
