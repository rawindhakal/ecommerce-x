"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { ProductForm } from "@/components/product-form";

export default function EditProductPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const [product, setProduct] = useState<any>(null);

  useEffect(() => {
    api.get<any>(`/api/products/admin/${params.id}`).then(setProduct);
  }, [params.id]);

  async function remove() {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    await api.delete(`/api/products/${params.id}`);
    router.push("/products");
  }

  if (!product) return <p className="text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edit Product</h1>
        <button onClick={remove} className="btn-danger"><Trash2 size={14} /> Delete Product</button>
      </div>
      <ProductForm initial={product} />
    </div>
  );
}
