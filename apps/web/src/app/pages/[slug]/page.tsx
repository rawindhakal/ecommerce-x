import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serverGet } from "@/lib/server-api";

interface CmsPage {
  title: string;
  content: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const page = await serverGet<CmsPage>(`/api/pages/${params.slug}`, 300);
  if (!page) return {};
  return { title: page.seoTitle ?? page.title, description: page.seoDescription ?? undefined };
}

export default async function CmsPage({ params }: { params: { slug: string } }) {
  const page = await serverGet<CmsPage>(`/api/pages/${params.slug}`, 60);
  if (!page) notFound();

  return (
    <div className="container-x max-w-3xl py-14">
      <h1 className="font-display text-3xl">{page.title}</h1>
      <div className="prose prose-sm mt-6 max-w-none text-ink/80" dangerouslySetInnerHTML={{ __html: page.content ?? "" }} />
    </div>
  );
}
