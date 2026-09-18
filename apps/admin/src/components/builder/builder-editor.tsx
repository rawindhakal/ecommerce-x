"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Monitor, Tablet, Smartphone, Undo2, Redo2, ExternalLink } from "lucide-react";
import {
  createSection,
  createWidget,
  type BuilderTree,
  type Breakpoint,
  type WidgetType,
  type NodeStyle,
} from "@ecommerce-x/shared";
import { api } from "@/lib/api";
import { WidgetPalette } from "./widget-palette";
import { Canvas } from "./canvas";
import { SettingsPanel } from "./settings-panel";
import {
  findNode,
  removeNode,
  insertWidget,
  moveWidget,
  moveSection,
  duplicateSection,
  duplicateWidget,
  updateColumn,
  updateNodeStyle,
  updateWidget,
} from "@/lib/builder-tree";

interface PageMeta {
  id: string;
  title: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED";
}

const HISTORY_LIMIT = 50;

export function BuilderEditor({ page, initialTree, storefrontUrl }: { page: PageMeta; initialTree: BuilderTree; storefrontUrl: string }) {
  const [tree, setTree] = useState<BuilderTree>(initialTree);
  const [history, setHistory] = useState<BuilderTree[]>([]);
  const [future, setFuture] = useState<BuilderTree[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("desktop");
  const [status, setStatus] = useState(page.status);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const commit = useCallback((next: BuilderTree) => {
    setHistory((h) => [...h.slice(-HISTORY_LIMIT + 1), tree]);
    setFuture([]);
    setTree(next);
  }, [tree]);

  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1]!;
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [tree, ...f]);
    setTree(prev);
  }

  function redo() {
    if (future.length === 0) return;
    const next = future[0]!;
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h, tree]);
    setTree(next);
  }

  const selectedNode = useMemo(() => (selectedId ? findNode(tree, selectedId) : null), [tree, selectedId]);

  async function save(publish?: boolean) {
    setSaving(true);
    try {
      const nextStatus = publish === undefined ? status : publish ? "PUBLISHED" : "DRAFT";
      await api.put(`/api/pages/${page.id}`, { layoutJson: tree, status: nextStatus });
      setStatus(nextStatus);
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-slate-50">
      <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link href="/cms/pages" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><ArrowLeft size={16} /></Link>
          <div>
            <p className="text-sm font-semibold leading-tight">{page.title}</p>
            <p className="text-[11px] text-slate-400">{saving ? "Saving…" : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : status === "PUBLISHED" ? "Published" : "Draft"}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([bp, Icon]) => (
            <button
              key={bp}
              onClick={() => setBreakpoint(bp)}
              className={`rounded-md p-1.5 ${breakpoint === bp ? "bg-white text-brand-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              title={bp}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={undo} disabled={history.length === 0} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Undo"><Undo2 size={16} /></button>
          <button onClick={redo} disabled={future.length === 0} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Redo"><Redo2 size={16} /></button>
          <a href={storefrontUrl} target="_blank" rel="noreferrer" className="btn-outline"><ExternalLink size={14} /> Preview</a>
          <button onClick={() => save(false)} disabled={saving} className="btn-outline">Save Draft</button>
          <button onClick={() => save(true)} disabled={saving} className="btn-primary">{status === "PUBLISHED" ? "Update & Publish" : "Publish"}</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="w-64 flex-shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
          <WidgetPalette onAddSection={(widths) => commit([...tree, createSection(widths)])} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto" onClick={() => setSelectedId(null)}>
          <Canvas
            tree={tree}
            breakpoint={breakpoint}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDropNewWidget={(columnId, index, type) => {
              const widget = createWidget(type as WidgetType);
              commit(insertWidget(tree, columnId, index, widget));
              setSelectedId(widget.id);
            }}
            onMoveWidget={(widgetId, toColumnId, toIndex) => commit(moveWidget(tree, widgetId, toColumnId, toIndex))}
            onMoveSection={(sectionId, toIndex) => commit(moveSection(tree, sectionId, toIndex))}
            onDeleteNode={(id) => { commit(removeNode(tree, id)); if (selectedId === id) setSelectedId(null); }}
            onDuplicateWidget={(id) => commit(duplicateWidget(tree, id))}
            onDuplicateSection={(id) => commit(duplicateSection(tree, id))}
          />
        </div>

        <div className="w-80 flex-shrink-0 overflow-y-auto border-l border-slate-200 bg-white">
          <SettingsPanel
            node={selectedNode}
            breakpoint={breakpoint}
            onUpdateProps={(props) => selectedId && commit(updateWidget(tree, selectedId, { props }))}
            onUpdateStyle={(style: NodeStyle) => selectedId && commit(updateNodeStyle(tree, selectedId, breakpoint, style))}
            onUpdateWidth={(width) => selectedId && commit(updateColumn(tree, selectedId, { width }))}
            onDelete={() => { if (selectedId) { commit(removeNode(tree, selectedId)); setSelectedId(null); } }}
            onDuplicate={() => {
              if (!selectedId || !selectedNode) return;
              if (selectedNode.kind === "widget") commit(duplicateWidget(tree, selectedId));
              else if (selectedNode.kind === "section") commit(duplicateSection(tree, selectedId));
            }}
          />
        </div>
      </div>
    </div>
  );
}
