import { ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type GridItem, GRID_COLUMNS, GRID_ROW_HEIGHT, GRID_GAP } from './sectionLayoutStore';
import styles from './SectionGrid.module.css';

// ── Types ────────────────────────────────────────────────────────────────

export interface SectionGridRenderItem {
  key: string;
  title: string;
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
  | { type: 'move'; key: string; origin: GridItem; startX: number; startY: number; moved: boolean; pointerId: number }
  | { type: 'resize'; edge: 'right' | 'bottom' | 'corner'; key: string; origin: GridItem; startX: number; startY: number; pointerId: number };

const DRAG_THRESHOLD = 4;

// ── Helpers ──────────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Map layout array to a lookup by key. */
function toMap(layout: GridItem[]): Map<string, GridItem> {
  return new Map(layout.map((it) => [it.key, it]));
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
  const interactionRef = useRef<Interaction | null>(null);

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

  // ── Pointer interaction ─────────────────────────────────────────────────

  const commit = useCallback((next: GridItem[]) => {
    // Persist placements only for items that still exist.
    const keys = new Set(items.map((i) => i.key));
    onLayoutChange(next.filter((it) => keys.has(it.key)));
  }, [items, onLayoutChange]);

  useEffect(() => {
    if (!editable) return;

    const handleMove = (e: PointerEvent) => {
      const it = interactionRef.current;
      if (!it || e.pointerId !== it.pointerId) return;
      const dCol = Math.round((e.clientX - it.startX) / colSpan);
      const dRow = Math.round((e.clientY - it.startY) / rowSpan);

      setDraft(() => {
        const map = toMap(effectiveLayout);
        const cur = map.get(it.key);
        if (!cur) return effectiveLayout;
        let next: GridItem;
        if (it.type === 'move') {
          if (Math.abs(e.clientX - it.startX) > DRAG_THRESHOLD || Math.abs(e.clientY - it.startY) > DRAG_THRESHOLD) {
            it.moved = true;
          }
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

    const handleUp = (e: PointerEvent) => {
      const it = interactionRef.current;
      if (!it || e.pointerId !== it.pointerId) return;
      interactionRef.current = null;
      setDraft((current) => {
        if (current) commit(current);
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
    };
  }, [editable, effectiveLayout, colSpan, rowSpan, columns, commit, onItemClick]);

  const startMove = useCallback((e: React.PointerEvent, key: string) => {
    if (!editable) { onItemClick?.(key); return; }
    const origin = layoutMap.get(key);
    if (!origin) return;
    e.preventDefault();
    interactionRef.current = { type: 'move', key, origin, startX: e.clientX, startY: e.clientY, moved: false, pointerId: e.pointerId };
  }, [editable, layoutMap, onItemClick]);

  const startResize = useCallback((e: React.PointerEvent, key: string, edge: 'right' | 'bottom' | 'corner') => {
    if (!editable) return;
    const origin = layoutMap.get(key);
    if (!origin) return;
    e.preventDefault();
    e.stopPropagation();
    interactionRef.current = { type: 'resize', edge, key, origin, startX: e.clientX, startY: e.clientY, pointerId: e.pointerId };
  }, [editable, layoutMap]);

  const draggingKey = interactionRef.current?.key ?? null;

  return (
    <div ref={containerRef} className={styles.grid} style={{ height: gridHeight }}>
      {containerWidth > 0 && items.map((item) => {
        const pos = layoutMap.get(item.key);
        if (!pos) return null;
        const left = pos.x * colSpan;
        const top = pos.y * rowSpan;
        const width = pos.w * cellWidth + (pos.w - 1) * gap;
        const height = pos.h * rowHeight + (pos.h - 1) * gap;
        const isDragging = draggingKey === item.key;
        return (
          <div
            key={item.key}
            className={`${styles.item} ${isDragging ? styles.itemDragging : ''}`}
            style={{ left, top, width, height }}
          >
            <div
              className={styles.itemHeader}
              onPointerDown={(e) => startMove(e, item.key)}
              title={item.title}
            >
              {item.title}
            </div>
            <div className={styles.itemBody}>
              {item.content}
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
