import { redirect } from "next/navigation";

export default async function SearchPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const params = new URLSearchParams();
  if (searchParams.q) params.set("search", searchParams.q);
  redirect(`/products?${params.toString()}`);
}
