"use client";

import {
  Heading as HeadingIcon,
  Type,
  Image as ImageIcon,
  MousePointerClick,
  MoveVertical,
  Minus,
  LayoutGrid,
  GalleryHorizontal,
  Video,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { WIDGET_TYPES, WIDGET_LABELS, COLUMN_LAYOUTS, type WidgetType } from "@ecommerce-x/shared";

const ICONS: Record<WidgetType, LucideIcon> = {
  heading: HeadingIcon,
  text: Type,
  image: ImageIcon,
  button: MousePointerClick,
  spacer: MoveVertical,
  divider: Minus,
  productGrid: LayoutGrid,
  banner: GalleryHorizontal,
  video: Video,
};

export function WidgetPalette({ onAddSection }: { onAddSection: (widths: number[]) => void }) {
  return (
    <div className="space-y-6 p-4">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sections</h3>
        <div className="grid grid-cols-2 gap-2">
          {COLUMN_LAYOUTS.map((layout) => (
            <button
              key={layout.label}
              onClick={() => onAddSection(layout.widths)}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-slate-300 p-2.5 text-[11px] text-slate-500 hover:border-brand-400 hover:text-brand-600"
            >
              <div className="flex h-6 w-full gap-0.5">
                {layout.widths.map((w, i) => (
                  <div key={i} className="rounded-sm bg-slate-200" style={{ flex: w }} />
                ))}
              </div>
              {layout.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Widgets</h3>
        <p className="mb-2 text-[11px] text-slate-400">Drag a widget into any column.</p>
        <div className="grid grid-cols-2 gap-2">
          {WIDGET_TYPES.map((type) => {
            const Icon = ICONS[type];
            return (
              <div
                key={type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-widget-type", type);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className="flex cursor-grab flex-col items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-3 text-[11px] text-slate-600 active:cursor-grabbing hover:border-brand-400 hover:text-brand-600"
              >
                <Icon size={18} />
                {WIDGET_LABELS[type]}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AddSectionButton({ onAdd }: { onAdd: (widths: number[]) => void }) {
  return (
    <button onClick={() => onAdd([1])} className="btn-outline w-full justify-center py-3">
      <Plus size={14} /> Add Section
    </button>
  );
}
