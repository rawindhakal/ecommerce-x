// Shared data model for the drag-and-drop page builder. A page is a tree:
// Section[] -> Column[] -> Widget[]. Both the storefront renderer
// (apps/web) and the admin editor (apps/admin) import this file so they
// agree on the exact same shape — only the *rendering* is duplicated per
// app (read-only vs. interactive), never the schema.

export type Breakpoint = "desktop" | "tablet" | "mobile";
export const BREAKPOINTS: Breakpoint[] = ["desktop", "tablet", "mobile"];

// A deliberately small, generic box-model + typography bag rather than
// arbitrary CSS — every node (section/column/widget) shares this same
// type, and the editor only shows the fields that make sense for that
// node's kind. Any field left unset falls through to the browser default
// (or, for tablet/mobile, to the next-wider breakpoint's value).
export interface NodeStyle {
  paddingTop?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  paddingRight?: string;
  backgroundColor?: string;
  backgroundImage?: string; // url, section-level only
  textAlign?: "left" | "center" | "right";
  color?: string;
  fontSize?: string;
  fontWeight?: "normal" | "bold";
  borderRadius?: string;
  minHeight?: string;
}

export type StyleByBreakpoint = Partial<Record<Breakpoint, NodeStyle>>;

export const WIDGET_TYPES = [
  "heading",
  "text",
  "image",
  "button",
  "spacer",
  "divider",
  "productGrid",
  "banner",
  "video",
] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

export interface WidgetPropsMap {
  heading: { text: string; level: "h1" | "h2" | "h3" | "h4" };
  text: { text: string };
  image: { url: string; altText: string; linkUrl?: string };
  button: { text: string; linkUrl: string; variant: "primary" | "outline" };
  spacer: { height: string };
  divider: Record<string, never>;
  productGrid: {
    heading?: string;
    source: "featured" | "newest" | "bestsellers" | "category" | "tag";
    categorySlug?: string;
    tag?: string;
    count: number;
    columns: 2 | 3 | 4;
  };
  banner: { imageUrl: string; heading?: string; subtext?: string; ctaText?: string; linkUrl?: string };
  video: { embedUrl: string };
}

// A proper discriminated union (keyed by `type`) rather than a generic
// `WidgetNode<T>` — this is what lets `switch (widget.type)` narrow
// `widget.props` correctly at every call site instead of leaving it as
// the union of every widget's props.
export type WidgetNode = {
  [K in WidgetType]: { id: string; kind: "widget"; type: K; props: WidgetPropsMap[K]; style: StyleByBreakpoint };
}[WidgetType];

export interface ColumnNode {
  id: string;
  kind: "column";
  /** Width as a fraction of the row, e.g. 0.5 for a 50% column. Siblings in a section should sum to 1. */
  width: number;
  style: StyleByBreakpoint;
  children: WidgetNode[];
}

export interface SectionNode {
  id: string;
  kind: "section";
  style: StyleByBreakpoint;
  columns: ColumnNode[];
}

export type BuilderNode = SectionNode | ColumnNode | WidgetNode;
export type BuilderTree = SectionNode[];

// Preset column splits offered when adding a section — kept small
// deliberately (matches how most builders present "layout" choices as a
// fixed picker rather than free-form fractions).
export const COLUMN_LAYOUTS: { label: string; widths: number[] }[] = [
  { label: "1 column", widths: [1] },
  { label: "2 columns (50/50)", widths: [0.5, 0.5] },
  { label: "2 columns (30/70)", widths: [0.3, 0.7] },
  { label: "2 columns (70/30)", widths: [0.7, 0.3] },
  { label: "3 columns", widths: [1 / 3, 1 / 3, 1 / 3] },
  { label: "4 columns", widths: [0.25, 0.25, 0.25, 0.25] },
];

export const WIDGET_LABELS: Record<WidgetType, string> = {
  heading: "Heading",
  text: "Text",
  image: "Image",
  button: "Button",
  spacer: "Spacer",
  divider: "Divider",
  productGrid: "Product Grid",
  banner: "Banner",
  video: "Video",
};

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function createWidget(type: WidgetType): WidgetNode {
  const defaults: WidgetPropsMap = {
    heading: { text: "Heading text", level: "h2" },
    text: { text: "Add your text here. Click to edit." },
    image: { url: "", altText: "" },
    button: { text: "Shop Now", linkUrl: "/products", variant: "primary" },
    spacer: { height: "40px" },
    divider: {},
    productGrid: { source: "featured", count: 8, columns: 4 },
    banner: { imageUrl: "", heading: "New Collection", subtext: "", ctaText: "Shop Now", linkUrl: "/products" },
    video: { embedUrl: "" },
  };
  return { id: genId(), kind: "widget", type, props: defaults[type], style: {} } as WidgetNode;
}

export function createColumn(width: number): ColumnNode {
  return { id: genId(), kind: "column", width, style: {}, children: [] };
}

export function createSection(widths: number[] = [1]): SectionNode {
  return { id: genId(), kind: "section", style: {}, columns: widths.map(createColumn) };
}

/** Resolves a node's effective style at a given breakpoint, cascading desktop -> tablet -> mobile. */
export function resolveStyle(style: StyleByBreakpoint, breakpoint: Breakpoint): NodeStyle {
  const desktop = style.desktop ?? {};
  if (breakpoint === "desktop") return desktop;
  const tablet = { ...desktop, ...(style.tablet ?? {}) };
  if (breakpoint === "tablet") return tablet;
  return { ...tablet, ...(style.mobile ?? {}) };
}

function styleToCss(s: NodeStyle): string {
  const decls: string[] = [];
  if (s.paddingTop) decls.push(`padding-top:${s.paddingTop}`);
  if (s.paddingBottom) decls.push(`padding-bottom:${s.paddingBottom}`);
  if (s.paddingLeft) decls.push(`padding-left:${s.paddingLeft}`);
  if (s.paddingRight) decls.push(`padding-right:${s.paddingRight}`);
  if (s.backgroundColor) decls.push(`background-color:${s.backgroundColor}`);
  if (s.backgroundImage) decls.push(`background-image:url(${JSON.stringify(s.backgroundImage)});background-size:cover;background-position:center`);
  if (s.textAlign) decls.push(`text-align:${s.textAlign}`);
  if (s.color) decls.push(`color:${s.color}`);
  if (s.fontSize) decls.push(`font-size:${s.fontSize}`);
  if (s.fontWeight) decls.push(`font-weight:${s.fontWeight === "bold" ? 700 : 400}`);
  if (s.borderRadius) decls.push(`border-radius:${s.borderRadius}`);
  if (s.minHeight) decls.push(`min-height:${s.minHeight}`);
  return decls.join(";");
}

/**
 * Walks the tree and emits one CSS ruleset per node (keyed by `.node-<id>`)
 * per breakpoint that has an override, wrapped in the matching media query.
 * Rendered once into a single <style> tag alongside the tree — this is how
 * per-breakpoint style overrides work without a CSS-in-JS library.
 */
export function buildResponsiveCss(tree: BuilderTree): string {
  const rules: { desktop: string[]; tablet: string[]; mobile: string[] } = { desktop: [], tablet: [], mobile: [] };

  function visit(node: BuilderNode) {
    for (const bp of BREAKPOINTS) {
      const css = node.style[bp];
      if (css && Object.keys(css).length > 0) {
        rules[bp].push(`.node-${node.id}{${styleToCss(css)}}`);
      }
    }
    if (node.kind === "section") node.columns.forEach(visit);
    if (node.kind === "column") node.children.forEach(visit);
  }
  tree.forEach(visit);

  // Column widths are structural, not a NodeStyle field — every column
  // gets a flex-basis rule (desktop) that collapses to full-width on
  // mobile, so sections always stack cleanly on small screens.
  for (const section of tree) {
    for (const column of section.columns) {
      const pct = Math.round(column.width * 10000) / 100;
      rules.desktop.push(`.node-${column.id}{flex:0 0 ${pct}%;max-width:${pct}%}`);
      rules.mobile.push(`.node-${column.id}{flex:0 0 100%;max-width:100%}`);
    }
  }

  return [
    rules.desktop.join("\n"),
    rules.tablet.length ? `@media (max-width: 1024px){${rules.tablet.join("\n")}}` : "",
    rules.mobile.length ? `@media (max-width: 640px){${rules.mobile.join("\n")}}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Reserved Page.slug that the storefront homepage checks for a builder layout. */
export const HOME_PAGE_SLUG = "__home__";
