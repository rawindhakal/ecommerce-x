"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Upload, Sparkles } from "lucide-react";
import { api, uploadFile, generateImage, API_URL } from "@/lib/api";
import { SuccessModal } from "@/components/success-modal";

interface Category { id: string; name: string }
interface Brand { id: string; name: string }

interface VariantForm {
  id?: string;
  sku: string;
  optionsText: string; // "shade:Nude 02" comma separated -> parsed
  price: string;
  compareAtPrice: string;
  stock: string;
}

interface ImageForm {
  id?: string;
  url: string;
  altText: string;
}

export interface ProductFormData {
  id?: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  status: string;
  categoryId: string;
  brandId: string;
  basePrice: string;
  compareAtPrice: string;
  isFeatured: boolean;
  tags: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  images: ImageForm[];
  variants: VariantForm[];
}

function parseOptions(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of text.split(",")) {
    const [k, v] = pair.split(":").map((s) => s.trim());
    if (k && v) out[k] = v;
  }
  return out;
}

function optionsToText(options: Record<string, string>): string {
  return Object.entries(options).map(([k, v]) => `${k}:${v}`).join(", ");
}

export function ProductForm({ initial }: { initial?: any }) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [genImageError, setGenImageError] = useState<string | null>(null);

  const [form, setForm] = useState<ProductFormData>(() => ({
    id: initial?.id,
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    description: initial?.description ?? "",
    shortDescription: initial?.shortDescription ?? "",
    status: initial?.status ?? "DRAFT",
    categoryId: initial?.categoryId ?? "",
    brandId: initial?.brandId ?? "",
    basePrice: initial?.basePrice ?? "",
    compareAtPrice: initial?.compareAtPrice ?? "",
    isFeatured: initial?.isFeatured ?? false,
    tags: initial?.tags?.join(", ") ?? "",
    seoTitle: initial?.seoTitle ?? "",
    seoDescription: initial?.seoDescription ?? "",
    seoKeywords: initial?.seoKeywords ?? "",
    images: initial?.images?.map((i: any) => ({ id: i.id, url: i.url, altText: i.altText ?? "" })) ?? [],
    variants: initial?.variants?.map((v: any) => ({ id: v.id, sku: v.sku, optionsText: optionsToText(v.options), price: v.price, compareAtPrice: v.compareAtPrice ?? "", stock: String(v.inventory?.[0]?.quantityOnHand ?? 0) })) ?? [
      { sku: "", optionsText: "", price: "", compareAtPrice: "", stock: "0" },
    ],
  }));

  useEffect(() => {
    api.get<Category[]>("/api/categories?includeInactive=true").then(setCategories);
    api.get<Brand[]>("/api/brands?includeInactive=true").then(setBrands);
  }, []);

  function updateVariant(idx: number, patch: Partial<VariantForm>) {
    setForm((f) => ({ ...f, variants: f.variants.map((v, i) => (i === idx ? { ...v, ...patch } : v)) }));
  }

  function addVariant() {
    setForm((f) => ({ ...f, variants: [...f.variants, { sku: "", optionsText: "", price: f.basePrice, compareAtPrice: "", stock: "0" }] }));
  }

  function removeVariant(idx: number) {
    setForm((f) => ({ ...f, variants: f.variants.filter((_, i) => i !== idx) }));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file);
    setForm((f) => ({ ...f, images: [...f.images, { url, altText: f.name }] }));
  }

  async function handleGenerateImage() {
    if (!form.name.trim()) {
      setGenImageError("Enter a product name first — it's used to generate the image.");
      return;
    }
    setGeneratingImage(true);
    setGenImageError(null);
    try {
      const prompt = `A clean, modern e-commerce product photo of "${form.name}"${form.shortDescription ? ` — ${form.shortDescription}` : ""}, centered on a plain white studio background, soft even lighting, no text or watermarks.`;
      const url = await generateImage(prompt);
      setForm((f) => ({ ...f, images: [...f.images, { url, altText: f.name }] }));
    } catch (err: any) {
      setGenImageError(err.message ?? "Image generation failed");
    } finally {
      setGeneratingImage(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        description: form.description || undefined,
        shortDescription: form.shortDescription || undefined,
        type: "VARIABLE",
        status: form.status,
        categoryId: form.categoryId || null,
        brandId: form.brandId || null,
        basePrice: Number(form.basePrice),
        compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
        isFeatured: form.isFeatured,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        seoTitle: form.seoTitle || undefined,
        seoDescription: form.seoDescription || undefined,
        seoKeywords: form.seoKeywords || undefined,
        images: form.images.map((img, idx) => ({ id: img.id, url: img.url, altText: img.altText, sortOrder: idx })),
        variants: form.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          options: parseOptions(v.optionsText),
          price: Number(v.price),
          compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : undefined,
        })),
      };

      let productId = form.id;
      const isCreate = !form.id;
      if (form.id) {
        await api.put(`/api/products/${form.id}`, payload);
      } else {
        const created = await api.post<{ id: string }>("/api/products", payload);
        productId = created.id;
      }

      // Sync stock for each variant via inventory adjust
      const productData = await api.get<any>(`/api/products/${form.slug}`);
      for (const v of form.variants) {
        const match = productData.variants.find((pv: any) => pv.sku === v.sku);
        if (!match) continue;
        const currentStock = match.inventory.reduce((s: number, i: any) => s + i.quantityOnHand, 0);
        const target = Number(v.stock || 0);
        const diff = target - currentStock;
        if (diff !== 0) {
          await api.post("/api/inventory/adjust", { variantId: match.id, change: diff, reason: "ADJUSTMENT", note: "Set from product form" });
        }
      }

      if (isCreate) {
        setCreatedName(form.name);
      } else {
        router.push(`/products/${productId}`);
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message ?? "Failed to save product");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <div><label className="label">Product Name</label><input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><label className="label">Slug</label><input required className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className="label">Short Description</label><input className="input" value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className="label">Description</label><textarea rows={4} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            <option value="">None</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Brand</label>
          <select className="input" value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>
            <option value="">None</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Base Price (NPR)</label>
          <input required type="number" step="0.01" className="input" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} />
        </div>
        <div>
          <label className="label">Compare-at Price</label>
          <input type="number" step="0.01" className="input" value={form.compareAtPrice} onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        <div className="sm:col-span-2"><label className="label">Tags (comma separated)</label><input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} /> Featured product
        </label>
      </div>

      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold">Images</h3>
        <div className="flex flex-wrap gap-3">
          {form.images.map((img, idx) => (
            <div key={idx} className="relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200">
              <img src={img.url.startsWith("http") ? img.url : `${API_URL}${img.url}`} alt={img.altText} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }))}
                className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-500"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-brand-400 hover:text-brand-500">
            <Upload size={18} />
            <span className="text-xs">Upload</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
          <button
            type="button"
            onClick={handleGenerateImage}
            disabled={generatingImage}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-brand-400 hover:text-brand-500 disabled:cursor-wait disabled:opacity-60"
          >
            <Sparkles size={18} className={generatingImage ? "animate-pulse" : ""} />
            <span className="text-xs">{generatingImage ? "Generating…" : "Generate with AI"}</span>
          </button>
        </div>
        {genImageError && <p className="mt-2 text-xs text-red-600">{genImageError}</p>}
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Variants</h3>
          <button type="button" onClick={addVariant} className="btn-outline"><Plus size={14} /> Add Variant</button>
        </div>
        <div className="space-y-3">
          {form.variants.map((v, idx) => (
            <div key={idx} className="grid grid-cols-2 gap-3 rounded-lg border border-slate-100 p-3 sm:grid-cols-5">
              <div>
                <label className="label">SKU</label>
                <input required className="input" value={v.sku} onChange={(e) => updateVariant(idx, { sku: e.target.value })} />
              </div>
              <div>
                <label className="label">Options (shade:Nude, size:M)</label>
                <input className="input" value={v.optionsText} onChange={(e) => updateVariant(idx, { optionsText: e.target.value })} />
              </div>
              <div>
                <label className="label">Price</label>
                <input required type="number" step="0.01" className="input" value={v.price} onChange={(e) => updateVariant(idx, { price: e.target.value })} />
              </div>
              <div>
                <label className="label">Stock (default warehouse)</label>
                <input type="number" className="input" value={v.stock} onChange={(e) => updateVariant(idx, { stock: e.target.value })} />
              </div>
              <div className="flex items-end">
                <button type="button" onClick={() => removeVariant(idx)} className="btn-danger w-full"><Trash2 size={14} /> Remove</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <h3 className="text-sm font-semibold sm:col-span-2">SEO</h3>
        <div className="sm:col-span-2"><label className="label">SEO Title</label><input className="input" value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className="label">SEO Description</label><textarea rows={2} className="input" value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className="label">SEO Keywords</label><input className="input" value={form.seoKeywords} onChange={(e) => setForm({ ...form, seoKeywords: e.target.value })} /></div>
      </div>

      <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save Product"}</button>

      <SuccessModal
        open={createdName !== null}
        title="Product created"
        message={createdName ? `"${createdName}" has been added to your catalog.` : undefined}
        actionLabel="Back to Products"
        onClose={() => router.push("/products")}
      />
    </form>
  );
}
