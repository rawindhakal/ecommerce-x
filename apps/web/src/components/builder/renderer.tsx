import Image from "next/image";
import Link from "next/link";
import {
  buildResponsiveCss,
  type BuilderTree,
  type ColumnNode,
  type SectionNode,
  type WidgetNode,
} from "@ecommerce-x/shared";
import { serverGet } from "@/lib/server-api";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { imgSrc, isSvg } from "@/lib/image";
import type { PaginatedResult } from "@ecommerce-x/shared";

/** Renders a published builder tree (homepage or a CMS page) read-only on the storefront. */
export async function BuilderRenderer({ tree }: { tree: BuilderTree }) {
  const css = buildResponsiveCss(tree);
  const sections = await Promise.all(tree.map((section) => renderSection(section)));
  return (
    <div>
      {/* eslint-disable-next-line react/no-danger -- generated, not user-supplied HTML */}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {sections}
    </div>
  );
}

async function renderSection(section: SectionNode) {
  const columns = await Promise.all(section.columns.map((col) => renderColumn(col)));
  return (
    <section key={section.id} className={`node-${section.id}`}>
      <div className="container-x flex flex-col gap-6 md:flex-row">{columns}</div>
    </section>
  );
}

async function renderColumn(column: ColumnNode) {
  const widgets = await Promise.all(column.children.map((w) => renderWidget(w)));
  return (
    <div key={column.id} className={`node-${column.id} flex flex-col gap-4`}>
      {widgets}
    </div>
  );
}

async function renderWidget(widget: WidgetNode) {
  const cls = `node-${widget.id}`;
  switch (widget.type) {
    case "heading": {
      const Tag = widget.props.level;
      return <Tag key={widget.id} className={`${cls} font-display`}>{widget.props.text}</Tag>;
    }
    case "text":
      return (
        <p key={widget.id} className={`${cls} whitespace-pre-line text-ink/80`}>
          {widget.props.text}
        </p>
      );
    case "image":
      if (!widget.props.url) return null;
      return (
        <div key={widget.id} className={cls}>
          <ImageWidgetBody url={widget.props.url} altText={widget.props.altText} linkUrl={widget.props.linkUrl} />
        </div>
      );
    case "button":
      return (
        <div key={widget.id} className={cls}>
          <Link href={widget.props.linkUrl} className={widget.props.variant === "outline" ? "btn-outline" : "btn-primary"}>
            {widget.props.text}
          </Link>
        </div>
      );
    case "spacer":
      return <div key={widget.id} className={cls} style={{ height: widget.props.height }} />;
    case "divider":
      return <hr key={widget.id} className={`${cls} border-ink/10`} />;
    case "banner":
      return (
        <div key={widget.id} className={`${cls} relative overflow-hidden rounded-2xl bg-blush`}>
          <BannerWidgetBody {...widget.props} />
        </div>
      );
    case "video":
      if (!widget.props.embedUrl) return null;
      return (
        <div key={widget.id} className={`${cls} aspect-video overflow-hidden rounded-2xl`}>
          <iframe src={widget.props.embedUrl} className="h-full w-full" allowFullScreen />
        </div>
      );
    case "productGrid":
      return (
        <div key={widget.id} className={cls}>
          <ProductGridWidgetBody {...widget.props} />
        </div>
      );
    default:
      return null;
  }
}

function ImageWidgetBody({ url, altText, linkUrl }: { url: string; altText: string; linkUrl?: string }) {
  const img = (
    <span className="relative block aspect-[16/9] w-full overflow-hidden rounded-xl bg-blush">
      <Image src={imgSrc(url)} alt={altText} fill unoptimized={isSvg(url)} className="object-cover" />
    </span>
  );
  return linkUrl ? <Link href={linkUrl}>{img}</Link> : img;
}

function BannerWidgetBody({
  imageUrl,
  heading,
  subtext,
  ctaText,
  linkUrl,
}: {
  imageUrl: string;
  heading?: string;
  subtext?: string;
  ctaText?: string;
  linkUrl?: string;
}) {
  return (
    <div className="relative flex min-h-[280px] items-center">
      {imageUrl && <Image src={imgSrc(imageUrl)} alt="" fill unoptimized={isSvg(imageUrl)} className="object-cover" />}
      <div className="relative z-10 p-8 text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.4)]">
        {heading && <h2 className="font-display text-3xl">{heading}</h2>}
        {subtext && <p className="mt-2 max-w-md">{subtext}</p>}
        {ctaText && linkUrl && (
          <Link href={linkUrl} className="btn-primary mt-5 inline-flex w-fit">
            {ctaText}
          </Link>
        )}
      </div>
    </div>
  );
}

async function ProductGridWidgetBody({
  heading,
  source,
  categorySlug,
  tag,
  count,
  columns,
}: {
  heading?: string;
  source: "featured" | "newest" | "bestsellers" | "category" | "tag";
  categorySlug?: string;
  tag?: string;
  count: number;
  columns: 2 | 3 | 4;
}) {
  const qs = new URLSearchParams({ pageSize: String(count) });
  if (source === "featured") qs.set("featured", "true");
  if (source === "newest") qs.set("sort", "newest");
  if (source === "bestsellers") qs.set("sort", "rating");
  if (source === "category" && categorySlug) qs.set("category", categorySlug);
  if (source === "tag" && tag) qs.set("tag", tag);

  const result = await serverGet<PaginatedResult<ProductCardData>>(`/api/products?${qs.toString()}`, 60);
  if (!result?.items.length) return null;

  const gridCols = columns === 2 ? "sm:grid-cols-2" : columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4";
  return (
    <div>
      {heading && <h2 className="mb-6 font-display text-2xl">{heading}</h2>}
      <div className={`grid grid-cols-2 gap-5 ${gridCols}`}>
        {result.items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
