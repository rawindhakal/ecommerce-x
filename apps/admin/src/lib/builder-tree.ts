import type { BuilderTree, BuilderNode, SectionNode, ColumnNode, WidgetNode, NodeStyle, Breakpoint } from "@ecommerce-x/shared";

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function findNode(tree: BuilderTree, id: string): BuilderNode | null {
  for (const section of tree) {
    if (section.id === id) return section;
    for (const column of section.columns) {
      if (column.id === id) return column;
      for (const widget of column.children) {
        if (widget.id === id) return widget;
      }
    }
  }
  return null;
}

function findColumnOf(tree: BuilderTree, widgetId: string): ColumnNode | null {
  for (const section of tree) {
    for (const column of section.columns) {
      if (column.children.some((w) => w.id === widgetId)) return column;
    }
  }
  return null;
}

export function updateSection(tree: BuilderTree, id: string, patch: Partial<SectionNode>): BuilderTree {
  return tree.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

export function updateColumn(tree: BuilderTree, id: string, patch: Partial<ColumnNode>): BuilderTree {
  return tree.map((s) => ({ ...s, columns: s.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
}

export function updateWidget(tree: BuilderTree, id: string, patch: Partial<WidgetNode>): BuilderTree {
  return tree.map((s) => ({
    ...s,
    columns: s.columns.map((c) => ({
      ...c,
      children: c.children.map((w) => (w.id === id ? ({ ...w, ...patch } as WidgetNode) : w)),
    })),
  }));
}

/** Merges a style patch into a node's style bucket for the given breakpoint, whatever kind of node it is. */
export function updateNodeStyle(tree: BuilderTree, id: string, breakpoint: Breakpoint, style: NodeStyle): BuilderTree {
  const node = findNode(tree, id);
  if (!node) return tree;
  const nextStyle = { ...node.style, [breakpoint]: style };
  if (node.kind === "section") return updateSection(tree, id, { style: nextStyle });
  if (node.kind === "column") return updateColumn(tree, id, { style: nextStyle });
  return updateWidget(tree, id, { style: nextStyle });
}

export function removeNode(tree: BuilderTree, id: string): BuilderTree {
  return tree
    .filter((s) => s.id !== id)
    .map((s) => ({ ...s, columns: s.columns.map((c) => ({ ...c, children: c.children.filter((w) => w.id !== id) })) }));
}

export function insertWidget(tree: BuilderTree, columnId: string, index: number, widget: WidgetNode): BuilderTree {
  return tree.map((s) => ({
    ...s,
    columns: s.columns.map((c) => {
      if (c.id !== columnId) return c;
      const children = [...c.children];
      children.splice(Math.max(0, Math.min(index, children.length)), 0, widget);
      return { ...c, children };
    }),
  }));
}

export function moveWidget(tree: BuilderTree, widgetId: string, toColumnId: string, toIndex: number): BuilderTree {
  const sourceColumn = findColumnOf(tree, widgetId);
  const widget = sourceColumn?.children.find((w) => w.id === widgetId);
  if (!widget) return tree;
  const withoutWidget = removeNode(tree, widgetId);
  return insertWidget(withoutWidget, toColumnId, toIndex, widget);
}

export function moveSection(tree: BuilderTree, sectionId: string, toIndex: number): BuilderTree {
  const section = tree.find((s) => s.id === sectionId);
  if (!section) return tree;
  const without = tree.filter((s) => s.id !== sectionId);
  const next = [...without];
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, section);
  return next;
}

function cloneWithNewIds<T extends BuilderNode>(node: T): T {
  if (node.kind === "widget") return { ...node, id: genId() };
  if (node.kind === "column") return { ...node, id: genId(), children: node.children.map(cloneWithNewIds) } as T;
  return { ...node, id: genId(), columns: node.columns.map(cloneWithNewIds) } as T;
}

export function duplicateSection(tree: BuilderTree, id: string): BuilderTree {
  const idx = tree.findIndex((s) => s.id === id);
  if (idx === -1) return tree;
  const copy = cloneWithNewIds(tree[idx]!);
  const next = [...tree];
  next.splice(idx + 1, 0, copy);
  return next;
}

export function duplicateWidget(tree: BuilderTree, id: string): BuilderTree {
  const column = findColumnOf(tree, id);
  const widget = column?.children.find((w) => w.id === id);
  if (!column || !widget) return tree;
  const copy = cloneWithNewIds(widget);
  const idx = column.children.findIndex((w) => w.id === id);
  return updateColumn(tree, column.id, { children: [...column.children.slice(0, idx + 1), copy, ...column.children.slice(idx + 1)] });
}
