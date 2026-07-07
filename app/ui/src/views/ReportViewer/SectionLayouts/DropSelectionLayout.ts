import type { GridItem } from './sectionLayoutStore';

/**
 * Drop reflow for a multi-cell selection.
 *
 * While dragging, a selection collapses into a stack of "cards" (handled in the
 * grid's render). This module owns what happens on **drop**:
 *
 *   1. All items are treated as an ordered sequence (reading order).
 *   2. The dragged cards are pulled out and re-inserted at the index that the
 *      primary card was dropped on — primary first, then the rest.
 *   3. The whole sequence is flow-packed back onto the grid left→right,
 *      wrapping to the next row when a card no longer fits. Items therefore stay
 *      x/y continuous: inserting cards pushes everything after them right/down
 *      in index order, with no gaps or overlaps.
 *
 * Kept separate from the grid component (mirroring `CleanupGridLayout`) so the
 * placement rules are easy to reason about and test in isolation.
 *
 * All coordinates are in whole grid cells.
 */

/** Reading order (top→bottom, then left→right) with a stable key tie-break. */
function readingOrder(items: GridItem[]): GridItem[] {
  return [...items].sort(
    (a, b) => a.y - b.y || a.x - b.x || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
}

/** Single scalar for reading-order comparison against a drop target. */
function orderKey(x: number, y: number, columns: number): number {
  return y * columns + x;
}

/**
 * Pack items sequentially onto the grid: each card is placed at the running
 * cursor and the cursor advances left→right, wrapping to a fresh row (advanced
 * by the current row's tallest card) when the next card overflows the columns.
 */
function flowPack(ordered: GridItem[], columns: number): GridItem[] {
  const packed: GridItem[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  for (const item of ordered) {
    const w = Math.min(item.w, columns);
    if (x + w > columns) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    packed.push({ ...item, w, x, y });
    x += w;
    rowHeight = Math.max(rowHeight, item.h);
  }
  return packed;
}

export interface DropSelectionParams {
  /** Current layout (all items). */
  layout: GridItem[];
  columns: number;
  /** Keys being dragged (the full selection), primary included. */
  draggedKeys: string[];
  /** The grabbed key — anchors the drop position. */
  primaryKey: string;
  /** Desired top-left cell for the primary card. */
  target: { x: number; y: number };
}

/**
 * Reflow `layout` after dropping a multi-card selection at `target`.
 * Returns a fresh, gap-free layout with the original array order preserved.
 */
export function dropSelectionIntoGrid({
  layout,
  columns,
  draggedKeys,
  primaryKey,
  target,
}: DropSelectionParams): GridItem[] {
  const dragged = new Set(draggedKeys);
  const map = new Map(layout.map((it) => [it.key, it]));
  if (!map.has(primaryKey)) return flowPack(readingOrder(layout), columns);

  // Remaining items (everything not being dragged) in reading order.
  const remaining = readingOrder(layout.filter((it) => !dragged.has(it.key)));

  // Insertion index: how many remaining items sit before the drop target.
  const targetKey = orderKey(Math.max(0, target.x), Math.max(0, target.y), columns);
  let insertAt = remaining.findIndex((it) => orderKey(it.x, it.y, columns) >= targetKey);
  if (insertAt === -1) insertAt = remaining.length;

  // Dragged cards, kept in the order they were clicked/selected (draggedKeys).
  const insertBlock = draggedKeys.filter((k) => map.has(k)).map((k) => map.get(k)!);

  // Splice the block into the sequence, then flow-pack the whole thing so
  // everything after the insertion point shifts right/down in index order.
  const ordered = [
    ...remaining.slice(0, insertAt),
    ...insertBlock,
    ...remaining.slice(insertAt),
  ];
  const packed = flowPack(ordered, columns);

  // Preserve the caller's original array order so React reconciliation is stable.
  const byKey = new Map(packed.map((it) => [it.key, it]));
  return layout.map((it) => byKey.get(it.key) ?? it);
}

