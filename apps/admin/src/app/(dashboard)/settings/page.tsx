"use client";

import { useEffect, useState } from "react";
import { api, uploadFile, API_URL } from "@/lib/api";

type Tab = "branding" | "payments" | "integrations" | "seo" | "shipping" | "tax" | "loyalty";

const TABS: { key: Tab; label: string }[] = [
  { key: "branding", label: "Branding & Contact" },
  { key: "payments", label: "Payment Gateways" },
  { key: "integrations", label: "Integrations" },
  { key: "seo", label: "SEO Defaults" },
  { key: "shipping", label: "Shipping" },
  { key: "tax", label: "Tax" },
  { key: "loyalty", label: "Loyalty Program" },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("branding");
  const [settings, setSettings] = useState<Record<string, Record<string, any>>>({});
  const [saved, setSaved] = useState(false);

  async function load() {
    setSettings(await api.get("/api/settings"));
  }
  useEffect(() => { load(); }, []);

  async function saveGroup(group: string, entries: Record<string, any>, secretKeys: string[] = []) {
    await api.put(`/api/settings/${group}`, { entries, secretKeys });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Settings</h1>
        {saved && <span className="text-sm text-green-600">Saved</span>}
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

      {tab === "branding" && <BrandingTab settings={settings} onSave={saveGroup} />}
      {tab === "payments" && <PaymentsTab settings={settings} onSave={saveGroup} />}
      {tab === "integrations" && <IntegrationsTab settings={settings} onSave={saveGroup} />}
      {tab === "seo" && <SeoTab settings={settings} onSave={saveGroup} />}
      {tab === "shipping" && <ShippingTab />}
      {tab === "tax" && <TaxTab />}
      {tab === "loyalty" && <LoyaltyTab />}
    </div>
  );
}

function BrandingTab({ settings, onSave }: { settings: any; onSave: (g: string, e: any, s?: string[]) => void }) {
  const [form, setForm] = useState<any>({});
  useEffect(() => { setForm({ ...settings.branding, ...settings.contact, ...settings.social }); }, [settings]);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file);
    setForm({ ...form, logoUrl: url });
  }

  return (
    <div className="space-y-6">
      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <h3 className="text-sm font-semibold sm:col-span-2">Branding</h3>
        <div><label className="label">Site Name</label><input className="input" value={form.siteName ?? ""} onChange={(e) => setForm({ ...form, siteName: e.target.value })} /></div>
        <div><label className="label">Tagline</label><input className="input" value={form.tagline ?? ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></div>
        <div>
          <label className="label">Logo</label>
          {form.logoUrl && <img src={form.logoUrl.startsWith("http") ? form.logoUrl : `${API_URL}${form.logoUrl}`} className="mb-2 h-12" />}
          <input type="file" accept="image/*" onChange={handleLogoUpload} />
        </div>
        <div>
          <label className="label">Primary Color</label>
          <input type="color" className="h-10 w-20 rounded" value={form.primaryColor ?? "#C2185B"} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
        </div>
        <div>
          <label className="label">Secondary Color</label>
          <input type="color" className="h-10 w-20 rounded" value={form.secondaryColor ?? "#1A1A1A"} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} />
        </div>
        <button
          className="btn-primary w-fit sm:col-span-2"
          onClick={() => onSave("branding", { siteName: form.siteName, tagline: form.tagline, logoUrl: form.logoUrl, faviconUrl: form.faviconUrl, primaryColor: form.primaryColor, secondaryColor: form.secondaryColor })}
        >
          Save Branding
        </button>
      </div>

      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <h3 className="text-sm font-semibold sm:col-span-2">Contact & Social</h3>
        <div><label className="label">Contact Email</label><input className="input" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><label className="label">Phone</label><input className="input" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className="label">Address</label><input className="input" value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div><label className="label">Facebook URL</label><input className="input" value={form.facebook ?? ""} onChange={(e) => setForm({ ...form, facebook: e.target.value })} /></div>
        <div><label className="label">Instagram URL</label><input className="input" value={form.instagram ?? ""} onChange={(e) => setForm({ ...form, instagram: e.target.value })} /></div>
        <button
          className="btn-primary w-fit sm:col-span-2"
          onClick={() => {
            onSave("contact", { email: form.email, phone: form.phone, address: form.address });
            onSave("social", { facebook: form.facebook, instagram: form.instagram, tiktok: form.tiktok ?? "" });
          }}
        >
          Save Contact & Social
        </button>
      </div>
    </div>
  );
}

function PaymentsTab({ settings, onSave }: { settings: any; onSave: (g: string, e: any, s?: string[]) => void }) {
  const [form, setForm] = useState<any>({ esewa: {}, fonepay: {}, cybersource_nicasia: {}, cod: {} });
  useEffect(() => { if (settings.payments) setForm(settings.payments); }, [settings]);

  function update(gateway: string, patch: any) {
    setForm({ ...form, [gateway]: { ...form[gateway], ...patch } });
  }

  function save() {
    onSave(
      "payments",
      { esewa: form.esewa, fonepay: form.fonepay, cybersource_nicasia: form.cybersource_nicasia, cod: form.cod },
      ["esewa", "fonepay", "cybersource_nicasia"]
    );
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">eSewa</h3>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.esewa?.enabled} onChange={(e) => update("esewa", { enabled: e.target.checked })} /> Enabled</label>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select className="input" value={form.esewa?.mode ?? "sandbox"} onChange={(e) => update("esewa", { mode: e.target.value })}>
            <option value="sandbox">Sandbox</option>
            <option value="live">Live</option>
          </select>
          <input className="input" placeholder="Merchant Code (product_code)" value={form.esewa?.merchantCode ?? ""} onChange={(e) => update("esewa", { merchantCode: e.target.value })} />
          <input className="input" type="password" placeholder="Secret Key" value={form.esewa?.secretKey ?? ""} onChange={(e) => update("esewa", { secretKey: e.target.value })} />
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Fonepay</h3>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.fonepay?.enabled} onChange={(e) => update("fonepay", { enabled: e.target.checked })} /> Enabled</label>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select className="input" value={form.fonepay?.mode ?? "sandbox"} onChange={(e) => update("fonepay", { mode: e.target.value })}>
            <option value="sandbox">Sandbox</option>
            <option value="live">Live</option>
          </select>
          <input className="input" placeholder="Merchant Code" value={form.fonepay?.merchantCode ?? ""} onChange={(e) => update("fonepay", { merchantCode: e.target.value })} />
          <input className="input" type="password" placeholder="Secret Key" value={form.fonepay?.secretKey ?? ""} onChange={(e) => update("fonepay", { secretKey: e.target.value })} />
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Card Payments — NIC Asia (CyberSource)</h3>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.cybersource_nicasia?.enabled} onChange={(e) => update("cybersource_nicasia", { enabled: e.target.checked })} /> Enabled</label>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <select className="input" value={form.cybersource_nicasia?.mode ?? "sandbox"} onChange={(e) => update("cybersource_nicasia", { mode: e.target.value })}>
            <option value="sandbox">Sandbox</option>
            <option value="live">Live</option>
          </select>
          <input className="input" placeholder="Profile ID" value={form.cybersource_nicasia?.profileId ?? ""} onChange={(e) => update("cybersource_nicasia", { profileId: e.target.value })} />
          <input className="input" placeholder="Access Key" value={form.cybersource_nicasia?.accessKey ?? ""} onChange={(e) => update("cybersource_nicasia", { accessKey: e.target.value })} />
          <input className="input" type="password" placeholder="Secret Key" value={form.cybersource_nicasia?.secretKey ?? ""} onChange={(e) => update("cybersource_nicasia", { secretKey: e.target.value })} />
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Cash on Delivery</h3>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.cod?.enabled} onChange={(e) => update("cod", { enabled: e.target.checked })} /> Enabled</label>
        </div>
      </div>

      <button className="btn-primary" onClick={save}>Save Payment Settings</button>
    </div>
  );
}

function IntegrationsTab({ settings, onSave }: { settings: any; onSave: (g: string, e: any) => void }) {
  const [form, setForm] = useState<any>({});
  useEffect(() => { setForm(settings.integrations ?? {}); }, [settings]);

  return (
    <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
      <div>
        <label className="label">Meta Pixel ID</label>
        <input className="input" placeholder="e.g. 1234567890" value={form.metaPixelId ?? ""} onChange={(e) => setForm({ ...form, metaPixelId: e.target.value })} />
      </div>
      <div>
        <label className="label">Google Tag Manager Container ID</label>
        <input className="input" placeholder="GTM-XXXXXXX" value={form.gtmContainerId ?? ""} onChange={(e) => setForm({ ...form, gtmContainerId: e.target.value })} />
      </div>
      <div>
        <label className="label">GA4 Measurement ID</label>
        <input className="input" placeholder="G-XXXXXXXXXX" value={form.ga4MeasurementId ?? ""} onChange={(e) => setForm({ ...form, ga4MeasurementId: e.target.value })} />
        <p className="mt-1 text-xs text-ink/40">Direct GA4 tag, separate from GTM — set this only if you're not already sending GA4 events through the GTM container above.</p>
      </div>
      <div>
        <label className="label">Google Search Console Verification</label>
        <input className="input" placeholder="Meta tag content value" value={form.googleSiteVerification ?? ""} onChange={(e) => setForm({ ...form, googleSiteVerification: e.target.value })} />
      </div>
      <div>
        <label className="label">Bing Webmaster Verification</label>
        <input className="input" placeholder="Meta tag content value" value={form.bingSiteVerification ?? ""} onChange={(e) => setForm({ ...form, bingSiteVerification: e.target.value })} />
      </div>
      <button className="btn-primary w-fit sm:col-span-2" onClick={() => onSave("integrations", form)}>Save Integrations</button>
    </div>
  );
}

function SeoTab({ settings, onSave }: { settings: any; onSave: (g: string, e: any) => void }) {
  const [form, setForm] = useState<any>({});
  useEffect(() => { setForm(settings.seo ?? {}); }, [settings]);

  return (
    <div className="card grid grid-cols-1 gap-4 p-5">
      <div><label className="label">Default Meta Title</label><input className="input" value={form.defaultTitle ?? ""} onChange={(e) => setForm({ ...form, defaultTitle: e.target.value })} /></div>
      <div><label className="label">Default Meta Description</label><textarea rows={2} className="input" value={form.defaultDescription ?? ""} onChange={(e) => setForm({ ...form, defaultDescription: e.target.value })} /></div>
      <div><label className="label">Default OG Image URL</label><input className="input" value={form.defaultOgImage ?? ""} onChange={(e) => setForm({ ...form, defaultOgImage: e.target.value })} /></div>
      <button className="btn-primary w-fit" onClick={() => onSave("seo", form)}>Save SEO Defaults</button>
    </div>
  );
}

function ShippingTab() {
  const [zones, setZones] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", districts: "" });

  async function load() { setZones(await api.get("/api/shipping/zones")); }
  useEffect(() => { load(); }, []);

  async function addZone(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/api/shipping/zones", { name: form.name, districts: form.districts.split(",").map((d) => d.trim()).filter(Boolean) });
    setForm({ name: "", districts: "" });
    load();
  }

  async function addRate(zoneId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await api.post("/api/shipping/rates", {
      zoneId,
      name: formData.get("name"),
      price: Number(formData.get("price")),
      freeAboveSpend: formData.get("freeAboveSpend") ? Number(formData.get("freeAboveSpend")) : undefined,
      estimatedDays: formData.get("estimatedDays"),
    });
    e.currentTarget.reset();
    load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addZone} className="card flex gap-3 p-5">
        <input required placeholder="Zone name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Districts (comma separated, blank = catch-all)" className="input" value={form.districts} onChange={(e) => setForm({ ...form, districts: e.target.value })} />
        <button type="submit" className="btn-primary whitespace-nowrap">Add Zone</button>
      </form>

      {zones.map((z) => (
        <div key={z.id} className="card p-5">
          <h3 className="text-sm font-semibold">{z.name}</h3>
          <p className="text-xs text-slate-400">{z.districts.length ? z.districts.join(", ") : "Catch-all (all other districts)"}</p>
          <table className="table-base mt-3">
            <thead><tr><th>Rate</th><th>Price</th><th>Free Above</th><th>ETA</th></tr></thead>
            <tbody>
              {z.rates.map((r: any) => (
                <tr key={r.id}><td>{r.name}</td><td>Rs. {r.price}</td><td>{r.freeAboveSpend ? `Rs. ${r.freeAboveSpend}` : "—"}</td><td>{r.estimatedDays}</td></tr>
              ))}
            </tbody>
          </table>
          <form
            onSubmit={(e) => addRate(z.id, e)}
            className="mt-3 flex flex-wrap gap-2"
          >
            <input name="name" required placeholder="Rate name" className="input w-32" />
            <input name="price" required type="number" placeholder="Price" className="input w-28" />
            <input name="freeAboveSpend" type="number" placeholder="Free above" className="input w-28" />
            <input name="estimatedDays" placeholder="ETA (1-2 days)" className="input w-32" />
            <button type="submit" className="btn-outline">Add Rate</button>
          </form>
        </div>
      ))}
    </div>
  );
}

function TaxTab() {
  const [rates, setRates] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", rate: "" });

  async function load() { setRates(await api.get("/api/tax")); }
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/api/tax", { name: form.name, rate: Number(form.rate) });
    setForm({ name: "", rate: "" });
    load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card flex gap-3 p-5">
        <input required placeholder="Tax name (VAT)" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input required type="number" step="0.01" placeholder="Rate %" className="input" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
        <button type="submit" className="btn-primary whitespace-nowrap">Add Tax Rate</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Name</th><th>Rate</th><th>Default</th></tr></thead>
          <tbody>
            {rates.map((r) => <tr key={r.id}><td>{r.name}</td><td>{r.rate}%</td><td>{r.isDefault ? "Yes" : ""}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LoyaltyTab() {
  const [form, setForm] = useState<any>(null);

  async function load() { setForm(await api.get("/api/loyalty/rules")); }
  useEffect(() => { load(); }, []);

  async function save() {
    await api.put("/api/loyalty/rules", {
      isActive: form.isActive,
      earnPointsPerNpr: Number(form.earnPointsPerNpr),
      redeemPointValue: Number(form.redeemPointValue),
      minRedeemPoints: Number(form.minRedeemPoints),
      maxRedeemPercent: Number(form.maxRedeemPercent),
      pointsExpireDays: form.pointsExpireDays ? Number(form.pointsExpireDays) : null,
    });
    load();
  }

  if (!form) return null;

  return (
    <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Loyalty program active</label>
      <div><label className="label">Points earned per NPR spent</label><input type="number" step="0.001" className="input" value={form.earnPointsPerNpr} onChange={(e) => setForm({ ...form, earnPointsPerNpr: e.target.value })} /></div>
      <div><label className="label">NPR value per point redeemed</label><input type="number" step="0.01" className="input" value={form.redeemPointValue} onChange={(e) => setForm({ ...form, redeemPointValue: e.target.value })} /></div>
      <div><label className="label">Minimum points to redeem</label><input type="number" className="input" value={form.minRedeemPoints} onChange={(e) => setForm({ ...form, minRedeemPoints: e.target.value })} /></div>
      <div><label className="label">Max % of order payable with points</label><input type="number" className="input" value={form.maxRedeemPercent} onChange={(e) => setForm({ ...form, maxRedeemPercent: e.target.value })} /></div>
      <div><label className="label">Points expire after (days, blank = never)</label><input type="number" className="input" value={form.pointsExpireDays ?? ""} onChange={(e) => setForm({ ...form, pointsExpireDays: e.target.value })} /></div>
      <button className="btn-primary w-fit sm:col-span-2" onClick={save}>Save Loyalty Rules</button>
    </div>
  );
}
