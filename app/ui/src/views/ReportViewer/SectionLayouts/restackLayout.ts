import { TILE_HEADER_ROWS, type GridItem } from './sectionLayoutStore';

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

/**
 * Resize each tile to a per-key target height (e.g. recomputed for a new cohort
 * count) while preserving the free arrangement: a tile is shifted in `y` by the
 * summed height *delta* of the tiles stacked above it in the same column span,
 * so gaps and relative order are kept and nothing overlaps. Keys absent from
 * `heightByKey` keep their current height.
 */
export function restackByHeights(layout: GridItem[], heightByKey: ReadonlyMap<string, number>): GridItem[] {
  const sharesColumn = (a: GridItem, b: GridItem) => a.x < b.x + b.w && a.x + a.w > b.x;
  const heightOf = (it: GridItem) => Math.max(TILE_HEADER_ROWS, heightByKey.get(it.key) ?? it.h);
  return layout.map((item) => {
    const shift = layout
      .filter((o) => o.key !== item.key && o.y < item.y && sharesColumn(o, item))
      .reduce((sum, o) => sum + (heightOf(o) - o.h), 0);
    return { ...item, h: heightOf(item), y: Math.max(0, item.y + shift) };
  });
}
