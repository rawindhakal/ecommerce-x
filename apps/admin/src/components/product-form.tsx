"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Upload, LibraryBig } from "lucide-react";
import { slugify } from "@ecommerce-x/shared";
import { api, uploadFile, ApiError, API_URL } from "@/lib/api";
import { SuccessModal } from "@/components/success-modal";
import { MediaLibraryPicker } from "@/components/media-library-picker";
import { FormLabel } from "@/components/form-label";
import { Spinner } from "@/components/spinner";
import { toast } from "@/lib/toast-store";

interface Category { id: string; name: string }
interface Brand { id: string; name: string }

interface VariantForm {
  id?: string;
  sku: string; // existing SKU, read-only — new variants get one auto-generated on save
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
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [uploading, setUploading] = useState(false);

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
    setUploading(true);
    try {
      const url = await uploadFile(file);
      setForm((f) => ({ ...f, images: [...f.images, { url, altText: f.name }] }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Image upload failed. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
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
          sku: v.sku || undefined, // omitted for new variants — server auto-generates one
          options: parseOptions(v.optionsText),
          price: Number(v.price),
          compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : undefined,
        })),
      };

      let productId = form.id;
      const isCreate = !form.id;
      let productData: any;
      if (form.id) {
        productData = await api.put(`/api/products/${form.id}`, payload);
      } else {
        productData = await api.post<any>("/api/products", payload);
        productId = productData.id;
      }

      // Sync stock for each variant via inventory adjust. Match by option
      // set rather than SKU — new variants don't have a client-known SKU
      // yet (the server just generated one), but their parsed options are
      // unique and known on both sides.
      for (const v of form.variants) {
        const options = parseOptions(v.optionsText);
        const match = v.id
          ? productData.variants.find((pv: any) => pv.id === v.id)
          : productData.variants.find((pv: any) => JSON.stringify(pv.options) === JSON.stringify(options));
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
        toast.success("Product updated");
        router.push(`/products/${productId}`);
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save product. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <div><FormLabel required>Product Name</FormLabel><input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div>
          <FormLabel>URL Slug</FormLabel>
          <input disabled className="input cursor-not-allowed bg-slate-50 text-slate-500" value={form.slug || (form.name ? slugify(form.name) : "")} placeholder="Generated automatically from the name" />
        </div>
        <div className="sm:col-span-2"><FormLabel>Short Description</FormLabel><input className="input" value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} /></div>
        <div className="sm:col-span-2"><FormLabel>Description</FormLabel><textarea rows={4} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div>
          <FormLabel>Category</FormLabel>
          <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            <option value="">None</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <FormLabel>Brand</FormLabel>
          <select className="input" value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>
            <option value="">None</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <FormLabel required>Base Price (NPR)</FormLabel>
          <input required type="number" step="0.01" className="input" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} />
        </div>
        <div>
          <FormLabel>Compare-at Price</FormLabel>
          <input type="number" step="0.01" className="input" value={form.compareAtPrice} onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })} />
        </div>
        <div>
          <FormLabel>Status</FormLabel>
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        <div className="sm:col-span-2"><FormLabel>Tags (comma separated)</FormLabel><input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
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
            {uploading ? <Spinner /> : <Upload size={18} />}
            <span className="text-xs">{uploading ? "Uploading…" : "Upload"}</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
          </label>
          <button
            type="button"
            onClick={() => setShowLibrary(true)}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-brand-400 hover:text-brand-500"
          >
            <LibraryBig size={18} />
            <span className="text-xs">Browse Library</span>
          </button>
        </div>
      </div>

      <MediaLibraryPicker
        open={showLibrary}
        onClose={() => setShowLibrary(false)}
        multiple
        onSelect={(picked) =>
          setForm((f) => ({ ...f, images: [...f.images, ...picked.map((p) => ({ url: p.url, altText: p.altText ?? f.name }))] }))
        }
      />

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Variants</h3>
          <button type="button" onClick={addVariant} className="btn-outline"><Plus size={14} /> Add Variant</button>
        </div>
        <div className="space-y-3">
          {form.variants.map((v, idx) => (
            <div key={idx} className="grid grid-cols-2 gap-3 rounded-lg border border-slate-100 p-3 sm:grid-cols-5">
              <div>
                <FormLabel>SKU</FormLabel>
                <input disabled className="input cursor-not-allowed bg-slate-50 text-slate-500" value={v.sku || "Auto-generated on save"} />
              </div>
              <div>
                <FormLabel>Options (shade:Nude, size:M)</FormLabel>
                <input className="input" value={v.optionsText} onChange={(e) => updateVariant(idx, { optionsText: e.target.value })} />
              </div>
              <div>
                <FormLabel required>Price</FormLabel>
                <input required type="number" step="0.01" className="input" value={v.price} onChange={(e) => updateVariant(idx, { price: e.target.value })} />
              </div>
              <div>
                <FormLabel>Stock (default warehouse)</FormLabel>
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
        <div className="sm:col-span-2"><FormLabel>SEO Title</FormLabel><input className="input" value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} /></div>
        <div className="sm:col-span-2"><FormLabel>SEO Description</FormLabel><textarea rows={2} className="input" value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} /></div>
        <div className="sm:col-span-2"><FormLabel>SEO Keywords</FormLabel><input className="input" value={form.seoKeywords} onChange={(e) => setForm({ ...form, seoKeywords: e.target.value })} /></div>
      </div>

      <button type="submit" disabled={saving} className="btn-primary">
        {saving && <Spinner />} {saving ? "Saving…" : "Save Product"}
      </button>

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
