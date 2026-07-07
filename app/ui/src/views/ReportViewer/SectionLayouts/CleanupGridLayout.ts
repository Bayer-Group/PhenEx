import type { GridItem } from './sectionLayoutStore';

/**
 * Overlap-free normalisation of a section grid.
 *
 * After a free-form drag or resize items can overlap. `cleanupGridLayout`
 * reflows them into a collision-free layout with a single rule: an item may
 * only ever move **down or right** — never up or left, and its left→right
 * order is preserved.
 *
 * Walking items in reading order, each one is slid right past whatever it
 * collides with. When it no longer fits within `columns`, it wraps onto a
 * fresh row directly below the blocker (x = 0). This alone guarantees zero
 * overlaps.
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

/** Resolve overlaps by sliding items right, wrapping to the next row. */
function resolveHorizontally(items: GridItem[], columns: number): GridItem[] {
  const placed: GridItem[] = [];
  for (const source of readingOrder(items)) {
    // Clamp width to the grid; leave x untouched so items never shift left.
    const item: GridItem = { ...source, w: Math.min(source.w, columns) };

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

/**
 * Reflow `layout` into a collision-free arrangement, only ever moving items
 * down or right.
 *
 * The returned array preserves the caller's original item order (keyed by
 * `key`) so React reconciliation stays stable.
 */
export function cleanupGridLayout(layout: GridItem[], columns: number): GridItem[] {
  const resolved = resolveHorizontally(layout, columns);
  const byKey = new Map(resolved.map((it) => [it.key, it]));
  return layout.map((it) => byKey.get(it.key) ?? it);
}
