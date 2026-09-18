"use client";

import { useState } from "react";
import { GripVertical, Trash2, Copy, Plus, LayoutGrid, GalleryHorizontal, Video, Image as ImageIcon, type LucideIcon } from "lucide-react";
import {
  buildResponsiveCss,
  type BuilderTree,
  type SectionNode,
  type ColumnNode,
  type WidgetNode,
  type WidgetType,
  type Breakpoint,
} from "@ecommerce-x/shared";
import { API_URL } from "@/lib/api";

function imgSrc(url: string) {
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}

const BREAKPOINT_WIDTH: Record<Breakpoint, string> = { desktop: "100%", tablet: "768px", mobile: "375px" };

interface CanvasProps {
  tree: BuilderTree;
  breakpoint: Breakpoint;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDropNewWidget: (columnId: string, index: number, type: WidgetType) => void;
  onMoveWidget: (widgetId: string, toColumnId: string, toIndex: number) => void;
  onMoveSection: (sectionId: string, toIndex: number) => void;
  onDeleteNode: (id: string) => void;
  onDuplicateWidget: (id: string) => void;
  onDuplicateSection: (id: string) => void;
}

export function Canvas(props: CanvasProps) {
  const { tree, breakpoint } = props;
  const css = buildResponsiveCss(tree);
  const [sectionDropIndex, setSectionDropIndex] = useState<number | null>(null);

  return (
    <div className="flex justify-center bg-slate-100 p-6">
      <div className="min-h-[600px] bg-white shadow-sm transition-all" style={{ width: BREAKPOINT_WIDTH[breakpoint], maxWidth: "100%" }}>
        {/* eslint-disable-next-line react/no-danger -- generated CSS, not user HTML */}
        <style dangerouslySetInnerHTML={{ __html: css }} />

        {tree.length === 0 && (
          <div className="flex h-[400px] items-center justify-center text-sm text-slate-400">
            Add a section from the left panel to get started.
          </div>
        )}

        {tree.map((section, idx) => (
          <div key={section.id}>
            <SectionDropLine
              active={sectionDropIndex === idx}
              onDragOver={() => setSectionDropIndex(idx)}
              onDragLeave={() => setSectionDropIndex(null)}
              onDrop={(e) => {
                const sectionId = e.dataTransfer.getData("application/x-section-move");
                if (sectionId) props.onMoveSection(sectionId, idx);
                setSectionDropIndex(null);
              }}
            />
            <SectionBlock {...props} section={section} />
          </div>
        ))}
        <SectionDropLine
          active={sectionDropIndex === tree.length}
          onDragOver={() => setSectionDropIndex(tree.length)}
          onDragLeave={() => setSectionDropIndex(null)}
          onDrop={(e) => {
            const sectionId = e.dataTransfer.getData("application/x-section-move");
            if (sectionId) props.onMoveSection(sectionId, tree.length);
            setSectionDropIndex(null);
          }}
        />
      </div>
    </div>
  );
}

function SectionDropLine({ active, onDragOver, onDragLeave, onDrop }: { active: boolean; onDragOver: () => void; onDragLeave: () => void; onDrop: (e: React.DragEvent) => void }) {
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(e); }}
      className={`h-2 transition-all ${active ? "bg-brand-400" : ""}`}
    />
  );
}

function SectionBlock(props: CanvasProps & { section: SectionNode }) {
  const { section, selectedId, onSelect } = props;
  const selected = selectedId === section.id;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect(section.id); }}
      className={`group relative node-${section.id} border-2 ${selected ? "border-brand-500" : "border-transparent hover:border-brand-200"}`}
    >
      <div className="pointer-events-none absolute -top-6 left-0 z-10 hidden items-center gap-1 rounded-t bg-brand-500 px-2 py-0.5 text-[10px] text-white group-hover:flex">
        Section
      </div>
      <div className="absolute right-1 top-1 z-10 hidden gap-1 group-hover:flex">
        <button
          draggable
          onDragStart={(e) => { e.dataTransfer.setData("application/x-section-move", section.id); e.dataTransfer.effectAllowed = "move"; }}
          className="rounded bg-white p-1 text-slate-500 shadow hover:text-brand-600"
          title="Drag to reorder"
        >
          <GripVertical size={13} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); props.onDuplicateSection(section.id); }} className="rounded bg-white p-1 text-slate-500 shadow hover:text-brand-600" title="Duplicate section">
          <Copy size={13} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); props.onDeleteNode(section.id); }} className="rounded bg-white p-1 text-slate-500 shadow hover:text-red-500" title="Delete section">
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex flex-col gap-0 md:flex-row">
        {section.columns.map((column) => (
          <ColumnBlock key={column.id} {...props} column={column} />
        ))}
      </div>
    </div>
  );
}

function ColumnBlock(props: CanvasProps & { column: ColumnNode }) {
  const { column, selectedId, onSelect } = props;
  const selected = selectedId === column.id;
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  function handleDrop(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    const newType = e.dataTransfer.getData("application/x-widget-type") as WidgetType;
    const movedId = e.dataTransfer.getData("application/x-widget-move");
    if (newType) props.onDropNewWidget(column.id, index, newType);
    else if (movedId) props.onMoveWidget(movedId, column.id, index);
    setDropIndex(null);
  }

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect(column.id); }}
      className={`node-${column.id} min-h-[60px] border-2 p-2 ${selected ? "border-brand-400" : "border-transparent hover:border-slate-200"}`}
    >
      <DropLine active={dropIndex === 0} onDragOver={() => setDropIndex(0)} onDragLeave={() => setDropIndex(null)} onDrop={(e) => handleDrop(e, 0)} />
      {column.children.length === 0 ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDropIndex(0); }}
          onDragLeave={() => setDropIndex(null)}
          onDrop={(e) => handleDrop(e, 0)}
          className={`flex h-16 items-center justify-center rounded border border-dashed text-[11px] ${dropIndex === 0 ? "border-brand-400 bg-brand-50 text-brand-500" : "border-slate-200 text-slate-300"}`}
        >
          Drop widgets here
        </div>
      ) : (
        column.children.map((widget, idx) => (
          <div key={widget.id}>
            <WidgetBlock {...props} widget={widget} sourceColumnId={column.id} />
            <DropLine active={dropIndex === idx + 1} onDragOver={() => setDropIndex(idx + 1)} onDragLeave={() => setDropIndex(null)} onDrop={(e) => handleDrop(e, idx + 1)} />
          </div>
        ))
      )}
    </div>
  );
}

function DropLine({ active, onDragOver, onDragLeave, onDrop }: { active: boolean; onDragOver: () => void; onDragLeave: () => void; onDrop: (e: React.DragEvent) => void }) {
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`h-1.5 rounded transition-all ${active ? "bg-brand-400" : ""}`}
    />
  );
}

function WidgetBlock(props: CanvasProps & { widget: WidgetNode; sourceColumnId: string }) {
  const { widget, selectedId, onSelect, sourceColumnId } = props;
  const selected = selectedId === widget.id;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect(widget.id); }}
      className={`node-${widget.id} group/widget relative my-1 border-2 ${selected ? "border-brand-500" : "border-transparent hover:border-brand-200"}`}
    >
      <div className="absolute right-1 top-1 z-10 hidden gap-1 group-hover/widget:flex">
        <button
          draggable
          onDragStart={(e) => { e.dataTransfer.setData("application/x-widget-move", widget.id); e.dataTransfer.effectAllowed = "move"; }}
          className="rounded bg-white p-1 text-slate-500 shadow hover:text-brand-600"
          title="Drag to move"
        >
          <GripVertical size={12} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); props.onDuplicateWidget(widget.id); }} className="rounded bg-white p-1 text-slate-500 shadow hover:text-brand-600" title="Duplicate">
          <Copy size={12} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); props.onDeleteNode(widget.id); }} className="rounded bg-white p-1 text-slate-500 shadow hover:text-red-500" title="Delete">
          <Trash2 size={12} />
        </button>
      </div>
      <WidgetPreview widget={widget} />
    </div>
  );
}

function WidgetPreview({ widget }: { widget: WidgetNode }) {
  switch (widget.type) {
    case "heading": {
      const Tag = widget.props.level;
      return <Tag className="font-display">{widget.props.text || "Heading text"}</Tag>;
    }
    case "text":
      return <p className="whitespace-pre-line text-sm text-slate-700">{widget.props.text || "Text"}</p>;
    case "image":
      return widget.props.url ? (
        <img src={imgSrc(widget.props.url)} alt="" className="aspect-[16/9] w-full rounded-lg object-cover" />
      ) : (
        <Placeholder icon={ImageIcon} label="Image — choose one in the panel" />
      );
    case "button":
      return (
        <span className={`inline-block rounded-full px-5 py-2 text-sm font-semibold ${widget.props.variant === "outline" ? "border border-ink text-ink" : "bg-brand-500 text-white"}`}>
          {widget.props.text || "Button"}
        </span>
      );
    case "spacer":
      return <div style={{ height: widget.props.height }} className="rounded border border-dashed border-slate-200" />;
    case "divider":
      return <hr className="border-slate-300" />;
    case "banner":
      return (
        <div className="relative flex min-h-[160px] items-center overflow-hidden rounded-xl bg-blush">
          {widget.props.imageUrl && <img src={imgSrc(widget.props.imageUrl)} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          <div className="relative z-10 p-5 text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.5)]">
            {widget.props.heading && <p className="font-display text-xl">{widget.props.heading}</p>}
            {widget.props.subtext && <p className="text-xs">{widget.props.subtext}</p>}
          </div>
          {!widget.props.imageUrl && <Placeholder icon={GalleryHorizontal} label="Banner — choose a background image" />}
        </div>
      );
    case "video":
      return <Placeholder icon={Video} label={widget.props.embedUrl || "Video — set an embed URL"} />;
    case "productGrid":
      return (
        <Placeholder
          icon={LayoutGrid}
          label={`Product Grid — ${widget.props.source}, ${widget.props.count} items, ${widget.props.columns} columns`}
        />
      );
    default:
      return null;
  }
}

function Placeholder({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-400">
      <Icon size={16} /> {label}
    </div>
  );
}
