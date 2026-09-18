"use client";

import { useState } from "react";
import { Trash2, Copy, Image as ImageIcon } from "lucide-react";
import type { BuilderNode, NodeStyle, Breakpoint } from "@ecommerce-x/shared";
import { MediaLibraryPicker } from "@/components/media-library-picker";
import { API_URL } from "@/lib/api";

function imgSrc(url: string) {
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}

const TYPOGRAPHY_WIDGETS = new Set(["heading", "text", "button"]);

export function SettingsPanel({
  node,
  breakpoint,
  onUpdateProps,
  onUpdateStyle,
  onUpdateWidth,
  onDelete,
  onDuplicate,
}: {
  node: BuilderNode | null;
  breakpoint: Breakpoint;
  onUpdateProps: (props: any) => void;
  onUpdateStyle: (style: NodeStyle) => void;
  onUpdateWidth?: (width: number) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [tab, setTab] = useState<"content" | "style">("content");

  if (!node) {
    return <div className="p-4 text-sm text-slate-400">Select a section, column, or widget to edit it.</div>;
  }

  const style = node.style[breakpoint] ?? {};
  const patchStyle = (patch: Partial<NodeStyle>) => onUpdateStyle({ ...style, ...patch });
  const label = node.kind === "widget" ? node.type : node.kind;
  const showTypography = node.kind === "widget" && TYPOGRAPHY_WIDGETS.has(node.type);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-100 p-3">
        <span className="text-xs font-semibold capitalize text-slate-700">{label}</span>
        <div className="flex gap-1">
          <button onClick={onDuplicate} title="Duplicate" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Copy size={14} /></button>
          <button onClick={onDelete} title="Delete" className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={14} /></button>
        </div>
      </div>

      <div className="flex border-b border-slate-100">
        {(["content", "style"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 border-b-2 py-2 text-xs font-medium capitalize ${tab === t ? "border-brand-500 text-brand-600" : "border-transparent text-slate-400"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "content" ? (
          node.kind === "widget" ? (
            <WidgetContentFields node={node} onUpdateProps={onUpdateProps} />
          ) : node.kind === "column" && onUpdateWidth ? (
            <div>
              <label className="label">Column Width (% of row)</label>
              <input
                type="number"
                min={5}
                max={100}
                className="input"
                value={Math.round(node.width * 100)}
                onChange={(e) => onUpdateWidth(Math.max(0.05, Math.min(1, Number(e.target.value) / 100)))}
              />
            </div>
          ) : (
            <p className="text-xs text-slate-400">No content options for this section.</p>
          )
        ) : (
          <div className="space-y-4">
            <p className="text-[11px] text-slate-400">Editing styles for: <span className="font-semibold capitalize">{breakpoint}</span></p>

            <div className="grid grid-cols-2 gap-2">
              <TextField label="Padding Top" value={style.paddingTop} onChange={(v) => patchStyle({ paddingTop: v })} placeholder="e.g. 40px" />
              <TextField label="Padding Bottom" value={style.paddingBottom} onChange={(v) => patchStyle({ paddingBottom: v })} placeholder="e.g. 40px" />
              <TextField label="Padding Left" value={style.paddingLeft} onChange={(v) => patchStyle({ paddingLeft: v })} placeholder="e.g. 16px" />
              <TextField label="Padding Right" value={style.paddingRight} onChange={(v) => patchStyle({ paddingRight: v })} placeholder="e.g. 16px" />
            </div>

            <ColorField label="Background Color" value={style.backgroundColor} onChange={(v) => patchStyle({ backgroundColor: v })} />
            {node.kind === "section" && (
              <TextField label="Background Image URL" value={style.backgroundImage} onChange={(v) => patchStyle({ backgroundImage: v })} placeholder="/uploads/..." />
            )}
            <TextField label="Min Height" value={style.minHeight} onChange={(v) => patchStyle({ minHeight: v })} placeholder="e.g. 400px" />
            <TextField label="Border Radius" value={style.borderRadius} onChange={(v) => patchStyle({ borderRadius: v })} placeholder="e.g. 16px" />

            {showTypography && (
              <>
                <div>
                  <label className="label">Text Align</label>
                  <div className="flex gap-1">
                    {(["left", "center", "right"] as const).map((a) => (
                      <button
                        key={a}
                        onClick={() => patchStyle({ textAlign: a })}
                        className={`flex-1 rounded border py-1.5 text-xs capitalize ${style.textAlign === a ? "border-brand-500 bg-brand-50 text-brand-600" : "border-slate-200 text-slate-500"}`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                <ColorField label="Text Color" value={style.color} onChange={(v) => patchStyle({ color: v })} />
                <TextField label="Font Size" value={style.fontSize} onChange={(v) => patchStyle({ fontSize: v })} placeholder="e.g. 32px" />
                <div>
                  <label className="label">Font Weight</label>
                  <select className="input" value={style.fontWeight ?? ""} onChange={(e) => patchStyle({ fontWeight: (e.target.value || undefined) as any })}>
                    <option value="">Default</option>
                    <option value="normal">Normal</option>
                    <option value="bold">Bold</option>
                  </select>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" className="h-9 w-12 rounded border border-slate-200" value={/^#[0-9a-f]{6}$/i.test(value ?? "") ? value : "#ffffff"} onChange={(e) => onChange(e.target.value)} />
        <input className="input" value={value ?? ""} placeholder="#C2185B or transparent" onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function ImagePickerField({ label, url, onChange }: { label: string; url: string; onChange: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <label className="label">{label}</label>
      {url && <img src={imgSrc(url)} alt="" className="mb-2 h-24 w-full rounded-lg border border-slate-200 object-cover" />}
      <button type="button" onClick={() => setOpen(true)} className="btn-outline w-full justify-center">
        <ImageIcon size={14} /> {url ? "Change Image" : "Choose Image"}
      </button>
      <MediaLibraryPicker open={open} onClose={() => setOpen(false)} onSelect={([picked]) => onChange(picked.url)} />
    </div>
  );
}

function WidgetContentFields({ node, onUpdateProps }: { node: Extract<BuilderNode, { kind: "widget" }>; onUpdateProps: (props: any) => void }) {
  const props = node.props as any;
  const patch = (p: any) => onUpdateProps({ ...props, ...p });

  switch (node.type) {
    case "heading":
      return (
        <div className="space-y-3">
          <div>
            <label className="label">Text</label>
            <textarea rows={2} className="input" value={props.text} onChange={(e) => patch({ text: e.target.value })} />
          </div>
          <div>
            <label className="label">Level</label>
            <select className="input" value={props.level} onChange={(e) => patch({ level: e.target.value })}>
              <option value="h1">H1</option>
              <option value="h2">H2</option>
              <option value="h3">H3</option>
              <option value="h4">H4</option>
            </select>
          </div>
        </div>
      );
    case "text":
      return (
        <div>
          <label className="label">Text</label>
          <textarea rows={5} className="input" value={props.text} onChange={(e) => patch({ text: e.target.value })} />
        </div>
      );
    case "image":
      return (
        <div className="space-y-3">
          <ImagePickerField label="Image" url={props.url} onChange={(url) => patch({ url })} />
          <div>
            <label className="label">Alt Text</label>
            <input className="input" value={props.altText} onChange={(e) => patch({ altText: e.target.value })} />
          </div>
          <div>
            <label className="label">Link URL (optional)</label>
            <input className="input" value={props.linkUrl ?? ""} onChange={(e) => patch({ linkUrl: e.target.value || undefined })} placeholder="/products" />
          </div>
        </div>
      );
    case "button":
      return (
        <div className="space-y-3">
          <div>
            <label className="label">Button Text</label>
            <input className="input" value={props.text} onChange={(e) => patch({ text: e.target.value })} />
          </div>
          <div>
            <label className="label">Link URL</label>
            <input className="input" value={props.linkUrl} onChange={(e) => patch({ linkUrl: e.target.value })} placeholder="/products" />
          </div>
          <div>
            <label className="label">Style</label>
            <select className="input" value={props.variant} onChange={(e) => patch({ variant: e.target.value })}>
              <option value="primary">Solid</option>
              <option value="outline">Outline</option>
            </select>
          </div>
        </div>
      );
    case "spacer":
      return (
        <div>
          <label className="label">Height</label>
          <input className="input" value={props.height} onChange={(e) => patch({ height: e.target.value })} placeholder="e.g. 40px" />
        </div>
      );
    case "divider":
      return <p className="text-xs text-slate-400">A simple horizontal rule — styled via the Style tab.</p>;
    case "banner":
      return (
        <div className="space-y-3">
          <ImagePickerField label="Background Image" url={props.imageUrl} onChange={(imageUrl) => patch({ imageUrl })} />
          <div>
            <label className="label">Heading</label>
            <input className="input" value={props.heading ?? ""} onChange={(e) => patch({ heading: e.target.value })} />
          </div>
          <div>
            <label className="label">Subtext</label>
            <input className="input" value={props.subtext ?? ""} onChange={(e) => patch({ subtext: e.target.value })} />
          </div>
          <div>
            <label className="label">Button Text</label>
            <input className="input" value={props.ctaText ?? ""} onChange={(e) => patch({ ctaText: e.target.value })} />
          </div>
          <div>
            <label className="label">Link URL</label>
            <input className="input" value={props.linkUrl ?? ""} onChange={(e) => patch({ linkUrl: e.target.value })} placeholder="/products" />
          </div>
        </div>
      );
    case "video":
      return (
        <div>
          <label className="label">Embed URL</label>
          <input className="input" value={props.embedUrl} onChange={(e) => patch({ embedUrl: e.target.value })} placeholder="https://www.youtube.com/embed/..." />
        </div>
      );
    case "productGrid":
      return (
        <div className="space-y-3">
          <div>
            <label className="label">Heading (optional)</label>
            <input className="input" value={props.heading ?? ""} onChange={(e) => patch({ heading: e.target.value })} />
          </div>
          <div>
            <label className="label">Source</label>
            <select className="input" value={props.source} onChange={(e) => patch({ source: e.target.value })}>
              <option value="featured">Featured</option>
              <option value="newest">Newest</option>
              <option value="bestsellers">Bestsellers (top rated)</option>
              <option value="category">Category</option>
              <option value="tag">Tag</option>
            </select>
          </div>
          {props.source === "category" && (
            <div>
              <label className="label">Category Slug</label>
              <input className="input" value={props.categorySlug ?? ""} onChange={(e) => patch({ categorySlug: e.target.value })} />
            </div>
          )}
          {props.source === "tag" && (
            <div>
              <label className="label">Tag</label>
              <input className="input" value={props.tag ?? ""} onChange={(e) => patch({ tag: e.target.value })} />
            </div>
          )}
          <div>
            <label className="label">Number of Products</label>
            <input type="number" min={1} max={24} className="input" value={props.count} onChange={(e) => patch({ count: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Columns</label>
            <select className="input" value={props.columns} onChange={(e) => patch({ columns: Number(e.target.value) })}>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>
        </div>
      );
    default:
      return null;
  }
}
