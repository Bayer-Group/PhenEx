import type { GridItem } from './sectionLayoutStore';
import { placeFreely } from './CleanupGridLayout';

/**
 * Drop affordance for a single-item (or multi-item) grid drag.
 *
 * As the pointer moves, {@link computeDropHint} classifies what it is over into
 * one of three intents, which drive both the on-screen indicator and, on
 * release, {@link resolveSingleDrop}:
 *
 *   - `swap`   : the middle of another tile — blur it, flip the two on drop.
 *   - `insert` : the edge/gap of a tile — draw a line, part the neighbour(s).
 *   - `free`   : empty cells — drop exactly where released, keeping gaps.
 *
 * Kept separate from the grid component (mirroring `CleanupGridLayout` and
 * `DropSelectionLayout`) so the placement rules are easy to reason about.
 *
 * All coordinates are in whole grid cells; `gx`/`gy` are fractional cells.
 */

export type InsertLine =
  | { orientation: 'vertical'; cellX: number; cellY: number; length: number }
  | { orientation: 'horizontal'; cellX: number; cellY: number; length: number };

export type DropHint =
  | { kind: 'swap'; targetKey: string }
  | { kind: 'insert'; target: { x: number; y: number }; line: InsertLine }
  | { kind: 'free' };

/** Central dead-zone (fraction) of a tile that reads as "swap" rather than "insert". */
const SWAP_ZONE = 0.32;

/**
 * Classify the fractional grid cell (`gx`, `gy`) the pointer is over relative
 * to the tiles in `layout` (excluding the one being dragged).
 */
export function computeDropHint(
  layout: GridItem[],
  gx: number,
  gy: number,
  draggedKey: string,
  allowSwap: boolean,
): DropHint {
  const hovered = layout.find(
    (o) => o.key !== draggedKey && gx >= o.x && gx < o.x + o.w && gy >= o.y && gy < o.y + o.h,
  );
  if (!hovered) return { kind: 'free' };

  const draggedW = layout.find((o) => o.key === draggedKey)?.w ?? 1;
  const lx = (gx - hovered.x) / hovered.w;
  const ly = (gy - hovered.y) / hovered.h;

  if (allowSwap && lx > SWAP_ZONE && lx < 1 - SWAP_ZONE && ly > SWAP_ZONE && ly < 1 - SWAP_ZONE) {
    return { kind: 'swap', targetKey: hovered.key };
  }

  const dl = lx, dr = 1 - lx, dt = ly, db = 1 - ly;
  const m = Math.min(dl, dr, dt, db);
  if (m === dl) {
    // Left edge: drop into the space to the left of the target so it isn't
    // shoved right when that space is free.
    return {
      kind: 'insert',
      target: { x: Math.max(0, hovered.x - draggedW), y: hovered.y },
      line: { orientation: 'vertical', cellX: hovered.x, cellY: hovered.y, length: hovered.h },
    };
  }
  if (m === dr) {
    return {
      kind: 'insert',
      target: { x: hovered.x + hovered.w, y: hovered.y },
      line: { orientation: 'vertical', cellX: hovered.x + hovered.w, cellY: hovered.y, length: hovered.h },
    };
  }
  if (m === dt) {
    return {
      kind: 'insert',
      target: { x: hovered.x, y: hovered.y },
      line: { orientation: 'horizontal', cellX: hovered.x, cellY: hovered.y, length: hovered.w },
    };
  }
  // Bottom edge: drop into the space below the target.
  return {
    kind: 'insert',
    target: { x: hovered.x, y: hovered.y + hovered.h },
    line: { orientation: 'horizontal', cellX: hovered.x, cellY: hovered.y + hovered.h, length: hovered.w },
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Apply a single-item drop to `layout` according to the current `hint`:
 *   - `swap`   : the dragged tile takes the target's slot; the target moves
 *                back to the dragged tile's `origin`.
 *   - `insert` : the dragged tile snaps to the indicated boundary; a vertical
 *                line pushes overlapped neighbours right, a horizontal line
 *                pushes them straight down.
 *   - `free`   : the tile stays where released; only overlaps are pushed.
 */
export function resolveSingleDrop(
  layout: GridItem[],
  key: string,
  origin: GridItem,
  hint: DropHint | null,
  columns: number,
): GridItem[] {
  if (hint?.kind === 'swap') {
    const targetPos = layout.find((c) => c.key === hint.targetKey);
    if (!targetPos) return layout;
    return layout.map((c) => {
      if (c.key === key) return { ...c, x: targetPos.x, y: targetPos.y };
      if (c.key === hint.targetKey) return { ...c, x: origin.x, y: origin.y };
      return c;
    });
  }
  if (hint?.kind === 'insert') {
    const moved = layout.map((c) =>
      c.key === key
        ? { ...c, x: clamp(hint.target.x, 0, columns - c.w), y: Math.max(0, hint.target.y) }
        : c,
    );
    return placeFreely(moved, key, columns, hint.line.orientation === 'horizontal' ? 'down' : 'right');
  }
  return placeFreely(layout, key, columns);
}
