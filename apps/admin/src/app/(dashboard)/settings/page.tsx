"use client";

import { useEffect, useState } from "react";
import { LibraryBig } from "lucide-react";
import { api, uploadFile, ApiError, API_URL } from "@/lib/api";
import { MediaLibraryPicker } from "@/components/media-library-picker";
import { FormLabel } from "@/components/form-label";
import { Spinner } from "@/components/spinner";
import { toast } from "@/lib/toast-store";

type Tab = "branding" | "payments" | "integrations" | "seo" | "shipping" | "loyalty";

const TABS: { key: Tab; label: string }[] = [
  { key: "branding", label: "Branding & Contact" },
  { key: "payments", label: "Payment Gateways" },
  { key: "integrations", label: "Integrations" },
  { key: "seo", label: "SEO Defaults" },
  { key: "shipping", label: "Shipping" },
  { key: "loyalty", label: "GlowPoints Program" },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("branding");
  const [settings, setSettings] = useState<Record<string, Record<string, any>>>({});

  async function load() {
    try {
      setSettings(await api.get("/api/settings"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load settings.");
    }
  }
  useEffect(() => { load(); }, []);

  async function saveGroup(group: string, entries: Record<string, any>, secretKeys: string[] = []) {
    try {
      await api.put(`/api/settings/${group}`, { entries, secretKeys });
      toast.success("Settings saved");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save settings. Please try again.");
      throw err;
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

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
      {tab === "loyalty" && <LoyaltyTab />}
    </div>
  );
}

function BrandingTab({ settings, onSave }: { settings: any; onSave: (g: string, e: any, s?: string[]) => Promise<void> }) {
  const [form, setForm] = useState<any>({});
  const [showLibrary, setShowLibrary] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  useEffect(() => { setForm({ ...settings.branding, ...settings.contact, ...settings.social }); }, [settings]);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file);
      setForm({ ...form, logoUrl: url });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Logo upload failed. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function saveBranding() {
    setSavingBranding(true);
    try {
      await onSave("branding", { siteName: form.siteName, tagline: form.tagline, logoUrl: form.logoUrl, faviconUrl: form.faviconUrl, primaryColor: form.primaryColor, secondaryColor: form.secondaryColor });
    } catch {
      // toast already shown by onSave
    } finally {
      setSavingBranding(false);
    }
  }

  async function saveContact() {
    setSavingContact(true);
    try {
      await onSave("contact", { email: form.email, phone: form.phone, address: form.address });
      await onSave("social", { facebook: form.facebook, instagram: form.instagram, tiktok: form.tiktok ?? "" });
    } catch {
      // toast already shown by onSave
    } finally {
      setSavingContact(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <h3 className="text-sm font-semibold sm:col-span-2">Branding</h3>
        <div><FormLabel>Site Name</FormLabel><input className="input" value={form.siteName ?? ""} onChange={(e) => setForm({ ...form, siteName: e.target.value })} /></div>
        <div><FormLabel>Tagline</FormLabel><input className="input" value={form.tagline ?? ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></div>
        <div>
          <FormLabel>Logo</FormLabel>
          {form.logoUrl && <img src={form.logoUrl.startsWith("http") ? form.logoUrl : `${API_URL}${form.logoUrl}`} className="mb-2 h-12" />}
          <div className="flex items-center gap-2">
            <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploading} />
            {uploading && <Spinner />}
            <button type="button" onClick={() => setShowLibrary(true)} className="btn-outline w-fit"><LibraryBig size={14} /> Browse Library</button>
          </div>
          <MediaLibraryPicker open={showLibrary} onClose={() => setShowLibrary(false)} onSelect={([picked]) => setForm({ ...form, logoUrl: picked.url })} />
        </div>
        <div>
          <FormLabel>Primary Color</FormLabel>
          <input type="color" className="h-10 w-20 rounded" value={form.primaryColor ?? "#C2185B"} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
        </div>
        <div>
          <FormLabel>Secondary Color</FormLabel>
          <input type="color" className="h-10 w-20 rounded" value={form.secondaryColor ?? "#1A1A1A"} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} />
        </div>
        <button disabled={savingBranding} className="btn-primary w-fit sm:col-span-2" onClick={saveBranding}>
          {savingBranding && <Spinner />} {savingBranding ? "Saving…" : "Save Branding"}
        </button>
      </div>

      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <h3 className="text-sm font-semibold sm:col-span-2">Contact & Social</h3>
        <div><FormLabel>Contact Email</FormLabel><input className="input" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><FormLabel>Phone</FormLabel><input className="input" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div className="sm:col-span-2"><FormLabel>Address</FormLabel><input className="input" value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div><FormLabel>Facebook URL</FormLabel><input className="input" value={form.facebook ?? ""} onChange={(e) => setForm({ ...form, facebook: e.target.value })} /></div>
        <div><FormLabel>Instagram URL</FormLabel><input className="input" value={form.instagram ?? ""} onChange={(e) => setForm({ ...form, instagram: e.target.value })} /></div>
        <button disabled={savingContact} className="btn-primary w-fit sm:col-span-2" onClick={saveContact}>
          {savingContact && <Spinner />} {savingContact ? "Saving…" : "Save Contact & Social"}
        </button>
      </div>
    </div>
  );
}

function PaymentsTab({ settings, onSave }: { settings: any; onSave: (g: string, e: any, s?: string[]) => Promise<void> }) {
  const [form, setForm] = useState<any>({ esewa: {}, fonepay: {}, cybersource_nicasia: {}, cod: {} });
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (settings.payments) setForm(settings.payments); }, [settings]);

  function update(gateway: string, patch: any) {
    setForm({ ...form, [gateway]: { ...form[gateway], ...patch } });
  }

  async function save() {
    setSaving(true);
    try {
      await onSave(
        "payments",
        { esewa: form.esewa, fonepay: form.fonepay, cybersource_nicasia: form.cybersource_nicasia, cod: form.cod },
        ["esewa", "fonepay", "cybersource_nicasia"]
      );
    } catch {
      // toast already shown by onSave
    } finally {
      setSaving(false);
    }
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

      <button disabled={saving} className="btn-primary" onClick={save}>
        {saving && <Spinner />} {saving ? "Saving…" : "Save Payment Settings"}
      </button>
    </div>
  );
}

function IntegrationsTab({ settings, onSave }: { settings: any; onSave: (g: string, e: any) => Promise<void> }) {
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(settings.integrations ?? {}); }, [settings]);

  async function save() {
    setSaving(true);
    try {
      await onSave("integrations", form);
    } catch {
      // toast already shown by onSave
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
      <div>
        <FormLabel>Meta Pixel ID</FormLabel>
        <input className="input" placeholder="e.g. 1234567890" value={form.metaPixelId ?? ""} onChange={(e) => setForm({ ...form, metaPixelId: e.target.value })} />
      </div>
      <div>
        <FormLabel>Google Tag Manager Container ID</FormLabel>
        <input className="input" placeholder="GTM-XXXXXXX" value={form.gtmContainerId ?? ""} onChange={(e) => setForm({ ...form, gtmContainerId: e.target.value })} />
      </div>
      <div>
        <FormLabel>GA4 Measurement ID</FormLabel>
        <input className="input" placeholder="G-XXXXXXXXXX" value={form.ga4MeasurementId ?? ""} onChange={(e) => setForm({ ...form, ga4MeasurementId: e.target.value })} />
        <p className="mt-1 text-xs text-ink/40">Direct GA4 tag, separate from GTM — set this only if you're not already sending GA4 events through the GTM container above.</p>
      </div>
      <div>
        <FormLabel>Google Search Console Verification</FormLabel>
        <input className="input" placeholder="Meta tag content value" value={form.googleSiteVerification ?? ""} onChange={(e) => setForm({ ...form, googleSiteVerification: e.target.value })} />
      </div>
      <div>
        <FormLabel>Bing Webmaster Verification</FormLabel>
        <input className="input" placeholder="Meta tag content value" value={form.bingSiteVerification ?? ""} onChange={(e) => setForm({ ...form, bingSiteVerification: e.target.value })} />
      </div>
      <button disabled={saving} className="btn-primary w-fit sm:col-span-2" onClick={save}>
        {saving && <Spinner />} {saving ? "Saving…" : "Save Integrations"}
      </button>
    </div>
  );
}

function SeoTab({ settings, onSave }: { settings: any; onSave: (g: string, e: any) => Promise<void> }) {
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(settings.seo ?? {}); }, [settings]);

  async function save() {
    setSaving(true);
    try {
      await onSave("seo", form);
    } catch {
      // toast already shown by onSave
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card grid grid-cols-1 gap-4 p-5">
      <div><FormLabel>Default Meta Title</FormLabel><input className="input" value={form.defaultTitle ?? ""} onChange={(e) => setForm({ ...form, defaultTitle: e.target.value })} /></div>
      <div><FormLabel>Default Meta Description</FormLabel><textarea rows={2} className="input" value={form.defaultDescription ?? ""} onChange={(e) => setForm({ ...form, defaultDescription: e.target.value })} /></div>
      <div><FormLabel>Default OG Image URL</FormLabel><input className="input" value={form.defaultOgImage ?? ""} onChange={(e) => setForm({ ...form, defaultOgImage: e.target.value })} /></div>
      <button disabled={saving} className="btn-primary w-fit" onClick={save}>
        {saving && <Spinner />} {saving ? "Saving…" : "Save SEO Defaults"}
      </button>
    </div>
  );
}

function ShippingTab() {
  const [zones, setZones] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", districts: "" });
  const [savingZone, setSavingZone] = useState(false);
  const [savingRateFor, setSavingRateFor] = useState<string | null>(null);

  async function load() {
    try {
      setZones(await api.get("/api/shipping/zones"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load shipping zones.");
    }
  }
  useEffect(() => { load(); }, []);

  async function addZone(e: React.FormEvent) {
    e.preventDefault();
    setSavingZone(true);
    try {
      await api.post("/api/shipping/zones", { name: form.name, districts: form.districts.split(",").map((d) => d.trim()).filter(Boolean) });
      toast.success("Shipping zone added");
      setForm({ name: "", districts: "" });
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add shipping zone. Please try again.");
    } finally {
      setSavingZone(false);
    }
  }

  async function addRate(zoneId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingRateFor(zoneId);
    try {
      const formData = new FormData(e.currentTarget);
      await api.post("/api/shipping/rates", {
        zoneId,
        name: formData.get("name"),
        price: Number(formData.get("price")),
        freeAboveSpend: formData.get("freeAboveSpend") ? Number(formData.get("freeAboveSpend")) : undefined,
        estimatedDays: formData.get("estimatedDays"),
      });
      toast.success("Shipping rate added");
      e.currentTarget.reset();
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add shipping rate. Please try again.");
    } finally {
      setSavingRateFor(null);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addZone} className="card flex gap-3 p-5">
        <input required placeholder="Zone name *" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Districts (comma separated, blank = catch-all)" className="input" value={form.districts} onChange={(e) => setForm({ ...form, districts: e.target.value })} />
        <button type="submit" disabled={savingZone} className="btn-primary whitespace-nowrap">
          {savingZone && <Spinner />} {savingZone ? "Adding…" : "Add Zone"}
        </button>
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
            <input name="name" required placeholder="Rate name *" className="input w-32" />
            <input name="price" required type="number" placeholder="Price *" className="input w-28" />
            <input name="freeAboveSpend" type="number" placeholder="Free above" className="input w-28" />
            <input name="estimatedDays" placeholder="ETA (1-2 days)" className="input w-32" />
            <button type="submit" disabled={savingRateFor === z.id} className="btn-outline">
              {savingRateFor === z.id ? <Spinner /> : "Add Rate"}
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}

function LoyaltyTab() {
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setForm(await api.get("/api/loyalty/rules"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load GlowPoints rules.");
    }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    try {
      await api.put("/api/loyalty/rules", {
        isActive: form.isActive,
        earnPointsPerNpr: Number(form.earnPointsPerNpr),
        redeemPointValue: Number(form.redeemPointValue),
        minRedeemPoints: Number(form.minRedeemPoints),
        maxRedeemPercent: Number(form.maxRedeemPercent),
        pointsExpireDays: form.pointsExpireDays ? Number(form.pointsExpireDays) : null,
      });
      toast.success("GlowPoints rules saved");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save GlowPoints rules. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!form) return null;

  return (
    <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> GlowPoints program active</label>
      <div><FormLabel>GlowPoints earned per NPR spent</FormLabel><input type="number" step="0.001" className="input" value={form.earnPointsPerNpr} onChange={(e) => setForm({ ...form, earnPointsPerNpr: e.target.value })} /></div>
      <div><FormLabel>NPR value per GlowPoint redeemed</FormLabel><input type="number" step="0.01" className="input" value={form.redeemPointValue} onChange={(e) => setForm({ ...form, redeemPointValue: e.target.value })} /></div>
      <div><FormLabel>Minimum GlowPoints to redeem</FormLabel><input type="number" className="input" value={form.minRedeemPoints} onChange={(e) => setForm({ ...form, minRedeemPoints: e.target.value })} /></div>
      <div><FormLabel>Max % of order payable with GlowPoints</FormLabel><input type="number" className="input" value={form.maxRedeemPercent} onChange={(e) => setForm({ ...form, maxRedeemPercent: e.target.value })} /></div>
      <div><FormLabel>GlowPoints expire after (days, blank = never)</FormLabel><input type="number" className="input" value={form.pointsExpireDays ?? ""} onChange={(e) => setForm({ ...form, pointsExpireDays: e.target.value })} /></div>
      <button disabled={saving} className="btn-primary w-fit sm:col-span-2" onClick={save}>
        {saving && <Spinner />} {saving ? "Saving…" : "Save GlowPoints Rules"}
      </button>
    </div>
  );
}
