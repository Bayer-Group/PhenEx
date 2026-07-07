import { ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type GridItem, GRID_COLUMNS, GRID_ROW_HEIGHT, GRID_GAP } from './sectionLayoutStore';
import { cleanupGridLayout } from './CleanupGridLayout';
import { GridItemContext } from './GridItemContext';
import styles from './SectionGrid.module.css';

// ── Types ────────────────────────────────────────────────────────────────

export interface SectionGridRenderItem {
  key: string;
  title: string;
  /** Optional rich title (e.g. editable) rendered in place of `title`. */
  titleNode?: ReactNode;
  content: ReactNode;
}

export interface SectionGridProps {
  items: SectionGridRenderItem[];
  layout: GridItem[];
  columns?: number;
  rowHeight?: number;
  gap?: number;
  editable?: boolean;
  onLayoutChange: (items: GridItem[]) => void;
  onItemClick?: (key: string) => void;
}

type Interaction =
  | { type: 'move'; key: string; origin: GridItem; startX: number; startY: number; startScrollTop: number; moved: boolean; pointerId: number }
  | { type: 'resize'; edge: 'right' | 'bottom' | 'corner'; key: string; origin: GridItem; startX: number; startY: number; startScrollTop: number; pointerId: number };

const DRAG_THRESHOLD = 4;
/** Distance from the scroll container edge (px) at which auto-scroll kicks in. */
const EDGE_SCROLL_ZONE = 64;
/** Maximum auto-scroll speed in px per frame. */
const EDGE_SCROLL_SPEED = 22;

// ── Helpers ──────────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Map layout array to a lookup by key. */
function toMap(layout: GridItem[]): Map<string, GridItem> {
  return new Map(layout.map((it) => [it.key, it]));
}

/** Nearest vertically scrollable ancestor of `el` (falls back to the window). */
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
 * A self-contained widget grid. Items are placed on an n-column grid; each
 * spans a whole number of columns/rows. Items can be moved (drag the header)
 * and resized (drag the right / bottom / corner handles); all changes snap to
 * grid units and are reported through `onLayoutChange`.
 */
export function SectionGrid({
  items,
  layout,
  columns = GRID_COLUMNS,
  rowHeight = GRID_ROW_HEIGHT,
  gap = GRID_GAP,
  editable = true,
  onLayoutChange,
  onItemClick,
}: SectionGridProps) {
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
  const rowSpan = rowHeight + gap;

  const totalRows = useMemo(
    () => effectiveLayout.reduce((max, it) => Math.max(max, it.y + it.h), 0),
    [effectiveLayout],
  );
  const gridHeight = totalRows > 0 ? totalRows * rowSpan - gap : 0;
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

    // Translate a pointer position into a draft placement. Includes any scroll
    // that happened since drag start so the item keeps following the cursor
    // while the container auto-scrolls.
    const applyDrag = (clientX: number, clientY: number) => {
      const it = interactionRef.current;
      if (!it) return;
      const scrollTop = scrollParentRef.current?.scrollTop ?? 0;
      const scrollDelta = scrollTop - it.startScrollTop;
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
      setDraft((current) => {
        if (current) commit(cleanupGridLayout(current, columns));
        return null;
      });
      // A pure click (no drag) navigates to the row.
      if (it.type === 'move' && !it.moved) onItemClick?.(it.key);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      stopAutoScroll();
    };
  }, [editable, effectiveLayout, colSpan, rowSpan, columns, commit, onItemClick]);

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
    interactionRef.current = { type: 'move', key, origin, startX: e.clientX, startY: e.clientY, startScrollTop: scrollParentRef.current?.scrollTop ?? 0, moved: false, pointerId: e.pointerId };
  }, [editable, layoutMap, onItemClick, bringToFront]);

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

  const draggingKey = interactionRef.current?.key ?? null;

  return (
    <div ref={containerRef} className={styles.grid} style={{ height: displayHeight }}>
      {containerWidth > 0 && items.map((item) => {
        const pos = layoutMap.get(item.key);
        if (!pos) return null;
        const left = pos.x * colSpan;
        const top = pos.y * rowSpan;
        const width = pos.w * cellWidth + (pos.w - 1) * gap;
        const height = pos.h * rowHeight + (pos.h - 1) * gap;
        const isDragging = draggingKey === item.key;
        const zIndex = zOrder.indexOf(item.key) + 1;
        return (
          <div
            key={item.key}
            className={`${styles.item} ${isDragging ? styles.itemDragging : ''}`}
            style={{ left, top, width, height, zIndex }}
          >
            <div
              className={styles.itemHeader}
              onPointerDown={(e) => startMove(e, item.key)}
              title={item.title}
            >
              {item.titleNode ?? item.title}
            </div>
            <div className={styles.itemBody}>
              <GridItemContext.Provider value={{ cols: pos.w }}>
                {item.content}
              </GridItemContext.Provider>
            </div>
            {editable && (
              <>
                <div className={styles.handle + ' ' + styles.handleRight} onPointerDown={(e) => startResize(e, item.key, 'right')} />
                <div className={styles.handle + ' ' + styles.handleBottom} onPointerDown={(e) => startResize(e, item.key, 'bottom')} />
                <div className={styles.handle + ' ' + styles.handleCorner} onPointerDown={(e) => startResize(e, item.key, 'corner')} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
