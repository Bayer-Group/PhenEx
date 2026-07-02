/**
 * Shared logic for collapsing a resizable panel by dragging it past a threshold.
 *
 * Behaviour (hysteresis):
 *  - While a panel is shown, dragging its width below `minSize - threshold`
 *    collapses it.
 *  - While a panel is collapsed, dragging its width back up to `minSize`
 *    re-shows it.
 *  - Between those two points the current collapsed state is preserved so the
 *    panel does not flicker around the boundary.
 */

export const DEFAULT_COLLAPSE_THRESHOLD = 100;

export interface DragCollapseResult {
  /** Whether the panel should be collapsed after this drag step. */
  collapsed: boolean;
  /** The width to apply when not collapsed (clamped to min/max). */
  width: number;
}

export interface DragCollapseParams {
  /** Unclamped panel width derived from the current mouse position. */
  desiredWidth: number;
  /** Current collapsed state of the panel. */
  isCollapsed: boolean;
  /** Minimum width the panel may occupy while shown. */
  minSize: number;
  /** Optional maximum width the panel may occupy while shown. */
  maxSize?: number;
  /** Extra px below `minSize` the user must drag to trigger collapse. */
  threshold?: number;
}

export const resolveDragCollapse = ({
  desiredWidth,
  isCollapsed,
  minSize,
  maxSize,
  threshold = DEFAULT_COLLAPSE_THRESHOLD,
}: DragCollapseParams): DragCollapseResult => {
  const clampMax = (w: number) => (maxSize != null ? Math.min(w, maxSize) : w);

  if (isCollapsed) {
    // Only re-show once the user drags back out to the minimum size.
    if (desiredWidth >= minSize) {
      return { collapsed: false, width: clampMax(desiredWidth) };
    }
    return { collapsed: true, width: 0 };
  }

  // Shown: collapse once dragged below (minSize - threshold).
  if (desiredWidth < minSize - threshold) {
    return { collapsed: true, width: 0 };
  }
  return { collapsed: false, width: clampMax(Math.max(desiredWidth, minSize)) };
};
