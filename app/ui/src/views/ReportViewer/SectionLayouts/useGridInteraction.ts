import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GridItem } from './sectionLayoutStore';
import { type GridSelection } from './GridSelection';

// ── Tunables ───────────────────────────────────────────────────────────────

/** Pointer travel (px) before a press becomes a drag rather than a click. */
const DRAG_THRESHOLD = 4;

// ── Types ────────────────────────────────────────────────────────────────

type Interaction =
  | {
      type: 'move';
      key: string;
      origin: GridItem;
      startX: number;
      startY: number;
      moved: boolean;
      pointerId: number;
      /** Start positions of every dragged cell (the whole selection for a
       *  multi-drag, else just the grabbed cell). All move by the same delta. */
      group: { key: string; x: number; y: number }[];
    }
  | { type: 'resize'; edge: 'right' | 'bottom' | 'corner'; key: string; origin: GridItem; startX: number; startY: number; pointerId: number;
      /** Original w/h of every item being resized (grabbed cell + selected peers). */
      group: { key: string; w: number; h: number }[] };

export interface UseGridInteractionParams {
  items: readonly { key: string }[];
  layout: GridItem[];
  columns: number;
  rowHeight: number;
  gap: number;
  rowGap: number;
  editable: boolean;
  /** Multi-cell selection, owned by the caller so it can drive a toolbar. */
  selection: GridSelection;
  /** Minimum grid-row span per item key; enforced during resize. */
  minHMap?: ReadonlyMap<string, number>;
  /** Current pan-zoom scale of the grid, so pointer deltas map to content cells. */
  scale?: number;
  /** Reference width (px) that sizes the grid columns — the card/viewport width,
   *  independent of how wide the free canvas has grown. */
  viewportWidth?: number;
  onLayoutChange: (items: GridItem[]) => void;
  onItemClick?: (key: string) => void;
}

export interface GridInteraction {
  containerRef: React.RefObject<HTMLDivElement | null>;
  containerWidth: number;
  effectiveLayout: GridItem[];
  layoutMap: Map<string, GridItem>;
  cellWidth: number;
  colSpan: number;
  rowSpan: number;
  /** Canvas size (px), sized to the item bounding box (min. the viewport). */
  canvasWidth: number;
  canvasHeight: number;
  /** Canvas origin in grid cells (≤ 0); items render at (x−originX, y−originY). */
  originX: number;
  originY: number;
  zOrder: string[];
  draggingKey: string | null;
  selection: GridSelection;
  startMove: (e: React.PointerEvent, key: string) => void;
  startResize: (e: React.PointerEvent, key: string, edge: 'right' | 'bottom' | 'corner') => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Map layout array to a lookup by key. */
function toMap(layout: GridItem[]): Map<string, GridItem> {
  return new Map(layout.map((it) => [it.key, it]));
}

/**
 * All pointer/drag/resize state and geometry for a {@link SectionGrid}'s
 * editable canvas. Items hold a free (x, y) position; drag and resize snap to
 * grid cells and commit raw — there is no collision resolution or reflow.
 */
export function useGridInteraction({
  items,
  layout,
  columns,
  rowHeight,
  gap,
  rowGap,
  editable,
  selection,
  minHMap,
  scale = 1,
  viewportWidth = 0,
  onLayoutChange,
  onItemClick,
}: UseGridInteractionParams): GridInteraction {
  const containerRef = useRef<HTMLDivElement>(null);
  // Read live so pointer-effect closures see the current zoom without re-binding.
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const [draft, setDraft] = useState<GridItem[] | null>(null);
  const interactionRef = useRef<Interaction | null>(null);
  // Keys ordered bottom→top; last entry has highest z-index.
  const [zOrder, setZOrder] = useState<string[]>(() => items.map((i) => i.key));

  // Multi-cell selection is owned by the caller; the grid just reflects it.
  const selectionRef = useRef<GridSelection>(selection);
  selectionRef.current = selection;

  const bringToFront = useCallback((key: string) => {
    setZOrder((prev) => [...prev.filter((k) => k !== key), key]);
  }, []);

  // Ensure every item has a placement; append missing ones after the last row.
  const effectiveLayout = useMemo(() => {
    const source = draft ?? layout;
    const map = toMap(source);
    const result: GridItem[] = [];
    let nextRow = source.reduce((max, it) => Math.max(max, it.y + it.h), 0);
    for (const item of items) {
      const placed = map.get(item.key);
      if (placed) {
        result.push(placed);
      } else {
        result.push({ key: item.key, x: 0, y: nextRow, w: Math.min(2, columns), h: 2 });
        nextRow += 2;
      }
    }
    return result;
  }, [draft, layout, items, columns]);

  const layoutMap = useMemo(() => toMap(effectiveLayout), [effectiveLayout]);

  const cellWidth = viewportWidth > 0 ? (viewportWidth - gap * (columns - 1)) / columns : 0;
  const colSpan = cellWidth + gap;
  // Vertical pitch is the bare row height; the gutter (rowGap) is a fixed inset
  // subtracted from each tile's rendered height, so it never accumulates across
  // the many rows a tall tile spans.
  const rowSpan = rowHeight;

  // Origin comes from the *committed* layout so it stays fixed during a drag (no
  // mid-gesture reflow); the draft may push the canvas right/down so it grows
  // live. On drop the committed layout changes and the origin renormalises, so
  // any item dragged into negative space returns to positive coordinates.
  const { originX, originY } = useMemo(() => {
    let minX = 0, minY = 0;
    for (const it of layout) { minX = Math.min(minX, it.x); minY = Math.min(minY, it.y); }
    return { originX: minX, originY: minY };
  }, [layout]);

  const { maxRight, maxBottom } = useMemo(() => {
    let maxRight = 0, maxBottom = 0;
    for (const it of effectiveLayout) {
      maxRight = Math.max(maxRight, it.x + it.w);
      maxBottom = Math.max(maxBottom, it.y + it.h);
    }
    return { maxRight, maxBottom };
  }, [effectiveLayout]);

  const canvasWidth = Math.max(viewportWidth, (maxRight - originX) * colSpan - gap);
  const canvasHeight = Math.max(0, (maxBottom - originY) * rowSpan - rowGap);

  // ── Pointer interaction ─────────────────────────────────────────────────

  const commit = useCallback((next: GridItem[]) => {
    // Persist raw placements for items that still exist — no collision cleanup.
    const keys = new Set(items.map((i) => i.key));
    onLayoutChange(next.filter((it) => keys.has(it.key)));
  }, [items, onLayoutChange]);

  useEffect(() => {
    if (!editable) return;

    // Translate the pointer into a draft. Every cell in the drag group moves by
    // the same snapped (dCol, dRow) delta; resize adjusts only the grabbed cell.
    // Nothing is clamped — items may enter negative space or run past the right
    // edge, and the canvas grows to fit.
    const applyDrag = (clientX: number, clientY: number) => {
      const it = interactionRef.current;
      if (!it) return;
      const s = scaleRef.current;
      const dCol = Math.round((clientX - it.startX) / s / colSpan);
      const dRow = Math.round((clientY - it.startY) / s / rowSpan);

      setDraft(() => {
        const map = toMap(effectiveLayout);
        if (it.type === 'move') {
          for (const g of it.group) {
            const cur = map.get(g.key);
            if (cur) map.set(g.key, { ...cur, x: g.x + dCol, y: g.y + dRow });
          }
        } else {
          for (const g of it.group) {
            const cur = map.get(g.key);
            if (cur) {
              const minH = minHMap?.get(g.key) ?? 1;
              const w = it.edge === 'bottom' ? cur.w : Math.max(1, g.w + dCol);
              const h = it.edge === 'right' ? cur.h : Math.max(minH, g.h + dRow);
              map.set(g.key, { ...cur, w, h });
            }
          }
        }
        return Array.from(map.values());
      });
    };

    const handleMove = (e: PointerEvent) => {
      const it = interactionRef.current;
      if (!it || e.pointerId !== it.pointerId) return;
      if (it.type === 'move' && (Math.abs(e.clientX - it.startX) > DRAG_THRESHOLD || Math.abs(e.clientY - it.startY) > DRAG_THRESHOLD)) {
        it.moved = true;
      }
      applyDrag(e.clientX, e.clientY);
    };

    const handleUp = (e: PointerEvent) => {
      const it = interactionRef.current;
      if (!it || e.pointerId !== it.pointerId) return;
      interactionRef.current = null;

      setDraft((current) => {
        // Commit exactly where things landed — a resize, or a real move.
        if (current && (it.type === 'resize' || it.moved)) commit(current);
        return null;
      });
      // A press without movement is a click: toggle this cell's selection.
      if (it.type === 'move' && !it.moved) selectionRef.current.toggle(it.key);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [editable, effectiveLayout, colSpan, rowSpan, minHMap, commit]);

  const startMove = useCallback((e: React.PointerEvent, key: string) => {
    if (!editable) { onItemClick?.(key); return; }
    const origin = layoutMap.get(key);
    if (!origin) return;
    e.preventDefault();
    bringToFront(key);

    // Grabbing a selected cell drags the whole selection; each member keeps its
    // relative position and moves by the same delta.
    const sel = selectionRef.current;
    const groupKeys = sel.isSelected(key) && sel.selected.size > 1 ? [...sel.selected] : [key];
    const group = groupKeys
      .map((k) => { const o = layoutMap.get(k); return o ? { key: k, x: o.x, y: o.y } : null; })
      .filter((g): g is { key: string; x: number; y: number } => g !== null);

    interactionRef.current = {
      type: 'move',
      key,
      origin,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      pointerId: e.pointerId,
      group,
    };
  }, [editable, layoutMap, onItemClick, bringToFront]);

  const startResize = useCallback((e: React.PointerEvent, key: string, edge: 'right' | 'bottom' | 'corner') => {
    if (!editable) return;
    const origin = layoutMap.get(key);
    if (!origin) return;
    e.preventDefault();
    e.stopPropagation();
    bringToFront(key);
    const sel = selectionRef.current;
    const groupKeys = sel.isSelected(key) && sel.selected.size > 1 ? [...sel.selected] : [key];
    const group = groupKeys
      .map((k) => { const o = layoutMap.get(k); return o ? { key: k, w: o.w, h: o.h } : null; })
      .filter((g): g is { key: string; w: number; h: number } => g !== null);
    interactionRef.current = { type: 'resize', edge, key, origin, startX: e.clientX, startY: e.clientY, pointerId: e.pointerId, group };
  }, [editable, layoutMap, bringToFront]);

  return {
    containerRef,
    containerWidth: viewportWidth,
    effectiveLayout,
    layoutMap,
    cellWidth,
    colSpan,
    rowSpan,
    canvasWidth,
    canvasHeight,
    originX,
    originY,
    zOrder,
    draggingKey: interactionRef.current?.key ?? null,
    selection,
    startMove,
    startResize,
  };
}
