"use client";

import { ProductForm } from "@/components/product-form";

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New Product</h1>
      <ProductForm />
    </div>
  );
}
