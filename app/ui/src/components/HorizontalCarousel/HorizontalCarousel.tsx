/**
 * Reusable horizontal carousel that fills its parent and centers on a
 * focused item.  Renders a horizontal row of cards with infinite-scroll-
 * style behaviour (loads N items on each side).
 *
 * The component handles:
 *  - Scrolling the focused cell into view on mount and on focus change
 *  - Horizontal wheel → scroll mapping
 *  - Keyboard left/right navigation
 *  - Click-to-navigate
 */

import { useRef, useEffect, useCallback, type FC, type ReactNode } from 'react';
import styles from './HorizontalCarousel.module.css';

// ── Constants ───────────────────────────────────────────────────────────

const DEFAULT_CELL_WIDTH = 160;
const DEFAULT_CELL_GAP = 6;
const DEFAULT_VISIBLE_NEIGHBOURS = 8;

// ── Types ───────────────────────────────────────────────────────────────

export interface CarouselItem {
  /** Unique key */
  id: string | number;
  /** Index in the full list */
  index: number;
}

interface HorizontalCarouselProps<T extends CarouselItem> {
  /** Full ordered list of items. */
  items: T[];
  /** Index of the currently focused item. */
  focusedIndex: number;
  /** Called when the user clicks a cell to navigate. */
  onNavigate: (index: number) => void;
  /** Render the content of a single cell. */
  renderCell: (item: T, isFocused: boolean) => ReactNode;
  /** Cell width in px (default 160). */
  cellWidth?: number;
  /** Gap between cells in px (default 6). */
  cellGap?: number;
  /** How many neighbours to render on each side of focus (default 8). */
  visibleNeighbours?: number;
  /** Height of the carousel strip in px. */
  height?: number;
}

// ── Component ───────────────────────────────────────────────────────────

export function HorizontalCarousel<T extends CarouselItem>({
  items,
  focusedIndex,
  onNavigate,
  renderCell,
  cellWidth = DEFAULT_CELL_WIDTH,
  cellGap = DEFAULT_CELL_GAP,
  visibleNeighbours = DEFAULT_VISIBLE_NEIGHBOURS,
  height,
}: HorizontalCarouselProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef<HTMLDivElement>(null);

  // Compute the visible window of items
  const startIdx = Math.max(0, focusedIndex - visibleNeighbours);
  const endIdx = Math.min(items.length - 1, focusedIndex + visibleNeighbours);
  const visibleItems = items.slice(startIdx, endIdx + 1);

  // Scroll focused cell into centre
  useEffect(() => {
    const scroller = scrollRef.current;
    const card = focusedRef.current;
    if (!scroller || !card) return;
    const target = card.offsetLeft - (scroller.clientWidth / 2) + (cellWidth / 2);
    scroller.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [focusedIndex, cellWidth]);

  // Initial instant scroll (no animation)
  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (didInitialScroll.current) return;
    const scroller = scrollRef.current;
    const card = focusedRef.current;
    if (!scroller || !card) return;
    didInitialScroll.current = true;
    const target = card.offsetLeft - (scroller.clientWidth / 2) + (cellWidth / 2);
    scroller.scrollTo({ left: Math.max(0, target), behavior: 'instant' });
  }, [cellWidth]);

  // Wheel → horizontal scroll
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      scroller.scrollBy({ left: e.deltaY, behavior: 'instant' });
    };
    scroller.addEventListener('wheel', onWheel, { passive: false });
    return () => scroller.removeEventListener('wheel', onWheel);
  }, []);

  const handleCellClick = useCallback(
    (index: number) => (e: React.MouseEvent) => {
      e.stopPropagation();
      onNavigate(index);
    },
    [onNavigate],
  );

  return (
    <div className={styles.wrapper} style={height != null ? { height } : undefined}>
      <div
        className={styles.scroller}
        ref={scrollRef}
        style={{ gap: cellGap, padding: `0 ${cellGap}px` }}
      >
        {visibleItems.map((item) => {
          const isFocused = item.index === focusedIndex;
          return (
            <div
              key={item.id}
              ref={isFocused ? focusedRef : null}
              className={`${styles.cell} ${isFocused ? styles.cellFocused : ''}`}
              style={{ width: cellWidth, minWidth: cellWidth }}
              onClick={handleCellClick(item.index)}
            >
              {renderCell(item, isFocused)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Re-export the cell label helpers as convenience sub-components
export const CarouselCellLabel: FC<{ children: ReactNode }> = ({ children }) => (
  <span className={styles.cellLabel}>{children}</span>
);

export const CarouselCellName: FC<{ children: ReactNode }> = ({ children }) => (
  <span className={styles.cellName}>{children}</span>
);

export const CarouselCellSection: FC<{ children: ReactNode }> = ({ children }) => (
  <span className={styles.cellSection}>{children}</span>
);
