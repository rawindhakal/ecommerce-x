import { redirect } from "next/navigation";

export default function SearchPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const params = new URLSearchParams();
  if (searchParams.q) params.set("search", searchParams.q);
  redirect(`/products?${params.toString()}`);
}
