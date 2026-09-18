"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { HOME_PAGE_SLUG, type BuilderTree } from "@ecommerce-x/shared";
import { api } from "@/lib/api";
import { BuilderEditor } from "@/components/builder/builder-editor";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002";

interface CmsPage {
  id: string;
  title: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED";
  layoutJson: BuilderTree | null;
}

export default function PageBuilderRoute() {
  const params = useParams<{ id: string }>();
  const [page, setPage] = useState<CmsPage | null>(null);

  useEffect(() => {
    api.get<CmsPage[]>("/api/pages?includeDrafts=true").then((pages) => {
      setPage(pages.find((p) => p.id === params.id) ?? null);
    });
  }, [params.id]);

  if (!page) return <div className="flex h-dvh items-center justify-center text-sm text-slate-400">Loading…</div>;

  const storefrontUrl = page.slug === HOME_PAGE_SLUG ? SITE_URL : `${SITE_URL}/pages/${page.slug}`;

  return (
    <BuilderEditor
      page={{ id: page.id, title: page.title, slug: page.slug, status: page.status }}
      initialTree={page.layoutJson ?? []}
      storefrontUrl={storefrontUrl}
    />
  );
}
