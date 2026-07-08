import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GridItem } from './sectionLayoutStore';
import { cleanupGridLayout } from './CleanupGridLayout';
import { dropSelectionIntoGrid } from './DropSelectionLayout';
import { computeDropHint, resolveSingleDrop, type DropHint } from './GridDropHint';
import { useGridSelection, type GridSelection } from './GridSelection';

// ── Tunables ───────────────────────────────────────────────────────────────

/** Pointer travel (px) before a press becomes a drag rather than a click. */
const DRAG_THRESHOLD = 4;
/** Distance from the scroll container edge (px) at which auto-scroll kicks in. */
const EDGE_SCROLL_ZONE = 64;
/** Maximum auto-scroll speed in px per frame. */
const EDGE_SCROLL_SPEED = 22;
/** Per-card offset (px) of the animated multi-drag stack. */
export const STACK_OFFSET = 7;

// ── Types ────────────────────────────────────────────────────────────────

type Interaction =
  | {
      type: 'move';
      key: string;
      origin: GridItem;
      startX: number;
      startY: number;
      startScrollTop: number;
      moved: boolean;
      pointerId: number;
      /** Present when the grabbed cell is part of the selection (multi-drag). */
      multi: {
        keys: string[];
        originLeft: number;
        originTop: number;
        curLeft: number;
        curTop: number;
      } | null;
    }
  | { type: 'resize'; edge: 'right' | 'bottom' | 'corner'; key: string; origin: GridItem; startX: number; startY: number; startScrollTop: number; pointerId: number };

/** Live position of the animated multi-card drag stack. */
export interface MultiStack {
  primaryKey: string;
  /** Selected keys other than the primary, in stack order (bottom→top). */
  trailing: string[];
  left: number;
  top: number;
}

export interface UseGridInteractionParams {
  items: readonly { key: string }[];
  layout: GridItem[];
  columns: number;
  rowHeight: number;
  gap: number;
  rowGap: number;
  editable: boolean;
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
  displayHeight: number;
  dropHint: DropHint | null;
  multiStack: MultiStack | null;
  zOrder: string[];
  draggingKey: string | null;
  selection: GridSelection;
  startMove: (e: React.PointerEvent, key: string) => void;
  startResize: (e: React.PointerEvent, key: string, edge: 'right' | 'bottom' | 'corner') => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Map layout array to a lookup by key. */
function toMap(layout: GridItem[]): Map<string, GridItem> {
  return new Map(layout.map((it) => [it.key, it]));
}

/** Nearest vertically scrollable ancestor of `el` (falls back to null). */
function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if (/(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * All pointer/drag/drop state and geometry for a {@link SectionGrid}. Owns the
 * measurement, drag drafts, auto-scroll, multi-drag stack and drop affordance,
 * exposing only what the component needs to render.
 */
export function useGridInteraction({
  items,
  layout,
  columns,
  rowHeight,
  gap,
  rowGap,
  editable,
  onLayoutChange,
  onItemClick,
}: UseGridInteractionParams): GridInteraction {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [draft, setDraft] = useState<GridItem[] | null>(null);
  const [interacting, setInteracting] = useState(false);
  const interactionRef = useRef<Interaction | null>(null);
  const scrollParentRef = useRef<HTMLElement | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const autoScrollRef = useRef<number | null>(null);
  // Container height captured at drag start; the grid must not grow mid-drag.
  const frozenHeightRef = useRef(0);
  const gridHeightRef = useRef(0);
  // Keys ordered bottom→top; last entry has highest z-index.
  const [zOrder, setZOrder] = useState<string[]>(() => items.map((i) => i.key));

  // Multi-cell selection lives in its own module; the grid just reflects it.
  const itemKeys = useMemo(() => items.map((i) => i.key), [items]);
  const selection = useGridSelection(itemKeys, editable);
  const selectionRef = useRef<GridSelection>(selection);
  selectionRef.current = selection;

  // Animated drag stack for a multi-cell selection (null when not multi-dragging).
  const [multiStack, setMultiStack] = useState<MultiStack | null>(null);

  // Where the current drag is hovering (drives the drop indicator + action).
  const [dropHint, setDropHint] = useState<DropHint | null>(null);
  const dropHintRef = useRef<DropHint | null>(null);
  dropHintRef.current = dropHint;

  const bringToFront = useCallback((key: string) => {
    setZOrder((prev) => [...prev.filter((k) => k !== key), key]);
  }, []);

  // Measure available width (drives cell size).
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(w);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
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

  const cellWidth = containerWidth > 0 ? (containerWidth - gap * (columns - 1)) / columns : 0;
  const colSpan = cellWidth + gap;
  // Vertical pitch is the bare row height; the gutter (rowGap) is a fixed inset
  // subtracted from each tile's rendered height, so it never accumulates across
  // the many rows a tall tile spans.
  const rowSpan = rowHeight;

  const totalRows = useMemo(
    () => effectiveLayout.reduce((max, it) => Math.max(max, it.y + it.h), 0),
    [effectiveLayout],
  );
  const gridHeight = totalRows > 0 ? totalRows * rowSpan - rowGap : 0;
  gridHeightRef.current = gridHeight;
  // While dragging, pin the height to its pre-drag value so the container never
  // grows under the pointer; auto-scroll reveals space via the padding instead.
  const displayHeight = interacting ? frozenHeightRef.current : gridHeight;

  // ── Pointer interaction ─────────────────────────────────────────────────

  const commit = useCallback((next: GridItem[]) => {
    // Persist placements only for items that still exist.
    const keys = new Set(items.map((i) => i.key));
    onLayoutChange(next.filter((it) => keys.has(it.key)));
  }, [items, onLayoutChange]);

  useEffect(() => {
    if (!editable) return;

    // Fractional grid cell under the pointer, then the matching drop hint.
    const hintAt = (clientX: number, clientY: number, draggedKey: string, allowSwap: boolean): DropHint => {
      const el = containerRef.current;
      if (!el) return { kind: 'free' };
      const r = el.getBoundingClientRect();
      return computeDropHint(effectiveLayout, (clientX - r.left) / colSpan, (clientY - r.top) / rowSpan, draggedKey, allowSwap);
    };

    // Translate a pointer position into a draft placement. Includes any scroll
    // that happened since drag start so the item keeps following the cursor
    // while the container auto-scrolls.
    const applyDrag = (clientX: number, clientY: number) => {
      const it = interactionRef.current;
      if (!it) return;
      const scrollTop = scrollParentRef.current?.scrollTop ?? 0;
      const scrollDelta = scrollTop - it.startScrollTop;

      // Multi-cell drag: cards collapse into an animated stack that follows the
      // pointer. No grid draft is produced until drop.
      if (it.type === 'move' && it.multi) {
        const left = it.multi.originLeft + (clientX - it.startX);
        const top = it.multi.originTop + (clientY - it.startY + scrollDelta);
        it.multi.curLeft = left;
        it.multi.curTop = top;
        setMultiStack({
          primaryKey: it.key,
          trailing: it.multi.keys.filter((k) => k !== it.key),
          left,
          top,
        });
        // Multi-drag only ever inserts (never swaps).
        setDropHint(hintAt(clientX, clientY, it.key, false));
        return;
      }

      const dCol = Math.round((clientX - it.startX) / colSpan);
      const dRow = Math.round((clientY - it.startY + scrollDelta) / rowSpan);

      setDraft(() => {
        const map = toMap(effectiveLayout);
        const cur = map.get(it.key);
        if (!cur) return effectiveLayout;
        let next: GridItem;
        if (it.type === 'move') {
          next = {
            ...cur,
            x: clamp(it.origin.x + dCol, 0, columns - it.origin.w),
            y: Math.max(0, it.origin.y + dRow),
          };
        } else if (it.edge === 'right') {
          next = { ...cur, w: clamp(it.origin.w + dCol, 1, columns - it.origin.x) };
        } else if (it.edge === 'bottom') {
          next = { ...cur, h: Math.max(1, it.origin.h + dRow) };
        } else {
          next = {
            ...cur,
            w: clamp(it.origin.w + dCol, 1, columns - it.origin.x),
            h: Math.max(1, it.origin.h + dRow),
          };
        }
        map.set(it.key, next);
        return Array.from(map.values());
      });

      // Update the drop affordance for a single-item move (resize shows none).
      if (it.type === 'move') setDropHint(hintAt(clientX, clientY, it.key, true));
    };

    // rAF loop: while the pointer sits near a scroll edge, keep scrolling and
    // re-applying the drag so the item tracks the cursor even when it's still.
    const tick = () => {
      autoScrollRef.current = requestAnimationFrame(tick);
      const sp = scrollParentRef.current;
      if (!sp || !interactionRef.current) return;
      const rect = sp.getBoundingClientRect();
      const { x, y } = pointerRef.current;
      let dy = 0;
      if (y < rect.top + EDGE_SCROLL_ZONE) {
        dy = -EDGE_SCROLL_SPEED * Math.min(1, (rect.top + EDGE_SCROLL_ZONE - y) / EDGE_SCROLL_ZONE);
      } else if (y > rect.bottom - EDGE_SCROLL_ZONE) {
        dy = EDGE_SCROLL_SPEED * Math.min(1, (y - (rect.bottom - EDGE_SCROLL_ZONE)) / EDGE_SCROLL_ZONE);
      }
      if (dy !== 0) {
        const before = sp.scrollTop;
        sp.scrollTop = before + dy;
        if (sp.scrollTop !== before) applyDrag(x, y);
      }
    };

    const stopAutoScroll = () => {
      if (autoScrollRef.current != null) {
        cancelAnimationFrame(autoScrollRef.current);
        autoScrollRef.current = null;
      }
    };

    const handleMove = (e: PointerEvent) => {
      const it = interactionRef.current;
      if (!it || e.pointerId !== it.pointerId) return;
      pointerRef.current = { x: e.clientX, y: e.clientY };
      if (it.type === 'move' && (Math.abs(e.clientX - it.startX) > DRAG_THRESHOLD || Math.abs(e.clientY - it.startY) > DRAG_THRESHOLD)) {
        it.moved = true;
      }
      if (autoScrollRef.current == null) autoScrollRef.current = requestAnimationFrame(tick);
      applyDrag(e.clientX, e.clientY);
    };

    const handleUp = (e: PointerEvent) => {
      const it = interactionRef.current;
      if (!it || e.pointerId !== it.pointerId) return;
      interactionRef.current = null;
      stopAutoScroll();
      setInteracting(false);
      const hint = dropHintRef.current;
      setDropHint(null);

      // Multi-cell drop: land the primary at the pointer cell, flow the rest.
      if (it.type === 'move' && it.multi) {
        setMultiStack(null);
        if (it.moved) {
          const target = {
            x: Math.round(it.multi.curLeft / colSpan),
            y: Math.round(it.multi.curTop / rowSpan),
          };
          commit(dropSelectionIntoGrid({
            layout: effectiveLayout,
            columns,
            draggedKeys: it.multi.keys,
            primaryKey: it.key,
            target,
          }));
          selectionRef.current.clear();
        } else {
          // A pure click toggles this cell's selection.
          selectionRef.current.toggle(it.key);
        }
        return;
      }

      setDraft((current) => {
        if (current) {
          if (it.type === 'move' && it.moved) {
            commit(resolveSingleDrop(current, it.key, it.origin, hint, columns));
          } else {
            // Resize: just resolve any overlap the grown item introduced.
            commit(cleanupGridLayout(current, columns));
          }
        }
        return null;
      });
      // A pure click (no drag) toggles selection.
      if (it.type === 'move' && !it.moved) selectionRef.current.toggle(it.key);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      stopAutoScroll();
    };
  }, [editable, effectiveLayout, colSpan, rowSpan, columns, commit]);

  const startMove = useCallback((e: React.PointerEvent, key: string) => {
    if (!editable) { onItemClick?.(key); return; }
    const origin = layoutMap.get(key);
    if (!origin) return;
    e.preventDefault();
    bringToFront(key);
    scrollParentRef.current = getScrollParent(containerRef.current);
    frozenHeightRef.current = gridHeightRef.current;
    pointerRef.current = { x: e.clientX, y: e.clientY };
    setInteracting(true);

    // Grabbing a selected cell drags the whole selection as an animated stack.
    const sel = selectionRef.current;
    const multi = sel.isSelected(key)
      ? {
          keys: [...sel.selected],
          originLeft: origin.x * colSpan,
          originTop: origin.y * rowSpan,
          curLeft: origin.x * colSpan,
          curTop: origin.y * rowSpan,
        }
      : null;

    interactionRef.current = {
      type: 'move',
      key,
      origin,
      startX: e.clientX,
      startY: e.clientY,
      startScrollTop: scrollParentRef.current?.scrollTop ?? 0,
      moved: false,
      pointerId: e.pointerId,
      multi,
    };
  }, [editable, layoutMap, onItemClick, bringToFront, colSpan, rowSpan]);

  const startResize = useCallback((e: React.PointerEvent, key: string, edge: 'right' | 'bottom' | 'corner') => {
    if (!editable) return;
    const origin = layoutMap.get(key);
    if (!origin) return;
    e.preventDefault();
    e.stopPropagation();
    bringToFront(key);
    scrollParentRef.current = getScrollParent(containerRef.current);
    frozenHeightRef.current = gridHeightRef.current;
    pointerRef.current = { x: e.clientX, y: e.clientY };
    setInteracting(true);
    interactionRef.current = { type: 'resize', edge, key, origin, startX: e.clientX, startY: e.clientY, startScrollTop: scrollParentRef.current?.scrollTop ?? 0, pointerId: e.pointerId };
  }, [editable, layoutMap, bringToFront]);

  return {
    containerRef,
    containerWidth,
    effectiveLayout,
    layoutMap,
    cellWidth,
    colSpan,
    rowSpan,
    displayHeight,
    dropHint,
    multiStack,
    zOrder,
    draggingKey: interactionRef.current?.key ?? null,
    selection,
    startMove,
    startResize,
  };
}
