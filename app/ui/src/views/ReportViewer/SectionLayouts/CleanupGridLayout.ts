import { TILE_HEADER_ROWS, type GridItem } from './sectionLayoutStore';

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

/**
 * Free placement: keep the dropped tile exactly where it landed and only
 * displace the tiles it actually overlaps.
 *
 * The `anchorKey` tile is pinned at its dropped cell; every other tile keeps
 * its position unless it collides. With `push: 'right'` (default) a colliding
 * tile slides right past the blocker and wraps onto the next row only when it
 * no longer fits within `columns`; with `push: 'down'` it is moved straight
 * down below the blocker. Untouched tiles — and any empty cells between them —
 * are left exactly as they were, so items can be scattered freely.
 *
 * The original array order is preserved so React reconciliation stays stable.
 */
export function placeFreely(
  layout: GridItem[],
  anchorKey: string,
  columns: number,
  push: 'right' | 'down' = 'right',
): GridItem[] {
  const anchorSrc = layout.find((it) => it.key === anchorKey);
  if (!anchorSrc) return cleanupGridLayout(layout, columns);

  const anchor: GridItem = { ...anchorSrc, w: Math.min(anchorSrc.w, columns) };
  anchor.x = Math.max(0, Math.min(anchor.x, columns - anchor.w));
  const placed: GridItem[] = [anchor];

  for (const source of readingOrder(layout.filter((it) => it.key !== anchorKey))) {
    const item: GridItem = { ...source, w: Math.min(source.w, columns) };
    for (let hit = firstCollision(item, placed); hit; hit = firstCollision(item, placed)) {
      if (push === 'down') {
        // Push the colliding tile straight down below the blocker.
        item.y = hit.y + hit.h;
      } else {
        const slidX = hit.x + hit.w;
        if (slidX + item.w <= columns) {
          item.x = slidX;
        } else {
          item.x = 0;
          item.y = hit.y + hit.h;
        }
      }
    }
    placed.push(item);
  }

  const byKey = new Map(placed.map((it) => [it.key, it]));
  return layout.map((it) => byKey.get(it.key) ?? it);
}


/**
 * Apply a cohort-count change to a layout by the row **delta** it produces,
 * preserving each cell's own vertical scale: every tile keeps its current
 * height and is grown/shrunk by `deltaRows`, and shifted in `y` by the delta
 * accumulated from the tiles stacked above it in the same column span.
 *
 * Because only the delta is applied (never a reset to a default height), a cell
 * the user manually resized keeps its relative size across cohort changes, and
 * manual gaps between tiles are preserved.
 *
 * Columns (x) and widths (w) are untouched. The original item order is kept so
 * React reconciliation stays stable.
 */
export function restackByCohortDelta(layout: GridItem[], deltaRows: number): GridItem[] {
  const sharesColumn = (a: GridItem, b: GridItem) => a.x < b.x + b.w && a.x + a.w > b.x;
  return layout.map((item) => {
    const tilesAbove = layout.filter((o) => o.key !== item.key && o.y < item.y && sharesColumn(o, item)).length;
    return {
      ...item,
      // Floor at the fixed header block so a shrunk tile never collapses to a
      // padding-only sliver (still shows its title + a little body).
      h: Math.max(TILE_HEADER_ROWS, item.h + deltaRows),
      y: Math.max(0, item.y + deltaRows * tilesAbove),
    };
  });
}
