import type { GridItem } from './sectionLayoutStore';

/**
 * Overlap-free normalisation of a section grid.
 *
 * After a free-form drag or resize items can overlap or hang off the right
 * edge. `cleanupGridLayout` reflows them into a tidy, collision-free layout in
 * two sweeps over the grid:
 *
 *   1. Horizontal — walk items in reading order and slide each one right past
 *      whatever it collides with. When it no longer fits within `columns`, wrap
 *      it onto a fresh row directly below the blocker (x = 0). This sweep alone
 *      already guarantees zero overlaps.
 *   2. Vertical — pull every item straight up into any free space the wrapping
 *      opened up, so the result has no dangling gaps.
 *
 * All coordinates are in whole grid cells.
 */

/** Do two grid rectangles overlap? */
function overlaps(a: GridItem, b: GridItem): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/** The first already-placed item that collides with `item`, if any. */
function firstCollision(item: GridItem, placed: GridItem[]): GridItem | undefined {
  return placed.find((p) => overlaps(item, p));
}

/** Reading order: top→bottom, then left→right; `key` breaks ties for stability. */
function readingOrder(items: GridItem[]): GridItem[] {
  return [...items].sort(
    (a, b) => a.y - b.y || a.x - b.x || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
}

/** Sweep 1: resolve overlaps by sliding right, wrapping to the next row. */
function resolveHorizontally(items: GridItem[], columns: number): GridItem[] {
  const placed: GridItem[] = [];
  for (const source of readingOrder(items)) {
    // Clamp the width to the grid and pull it back inside the right edge.
    const w = Math.min(source.w, columns);
    const item: GridItem = { ...source, w, x: Math.max(0, Math.min(source.x, columns - w)) };

    for (let hit = firstCollision(item, placed); hit; hit = firstCollision(item, placed)) {
      const slidX = hit.x + hit.w;
      if (slidX + item.w <= columns) {
        // Room remains on this row: slide just past the blocking item.
        item.x = slidX;
      } else {
        // Out of room: wrap onto a fresh row directly below the blocker.
        item.x = 0;
        item.y = hit.y + hit.h;
      }
    }
    placed.push(item);
  }
  return placed;
}

/** Sweep 2: pull each item up into any free space above it. */
function compactVertically(items: GridItem[]): GridItem[] {
  const placed: GridItem[] = [];
  for (const source of readingOrder(items)) {
    const item = { ...source };
    while (item.y > 0 && !firstCollision({ ...item, y: item.y - 1 }, placed)) {
      item.y -= 1;
    }
    placed.push(item);
  }
  return placed;
}

/**
 * Reflow `layout` into a collision-free, gap-free arrangement.
 *
 * The returned array preserves the caller's original item order (keyed by
 * `key`) so React reconciliation stays stable.
 */
export function cleanupGridLayout(layout: GridItem[], columns: number): GridItem[] {
  const resolved = compactVertically(resolveHorizontally(layout, columns));
  const byKey = new Map(resolved.map((it) => [it.key, it]));
  return layout.map((it) => byKey.get(it.key) ?? it);
}
