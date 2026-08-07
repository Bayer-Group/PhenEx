import { memo, useEffect, useState } from 'react';
import { usePanZoom } from '../../../hooks/usePanZoom';
import { PanZoomScaleProvider } from '../../../hooks/PanZoomScaleContext';
import { PanZoomScrollbar } from '../../../components/CustomScrollbar/PanZoomScrollbar/PanZoomScrollbar';
import { ZoomScrubber } from '../unused/ZoomScrubber';
import { SectionGrid, type SectionGridProps } from './SectionGrid';
import styles from './ZoomableSectionGrid.module.css';

const MIN_SCALE = 0.3;
const MAX_SCALE = 2;

export interface ZoomableSectionGridProps extends SectionGridProps {
  /** localStorage key for persisting the zoom/pan transform. */
  storageKey?: string;
  /**
   * Changes to this token trigger a content re-measure (e.g. when the grid's
   * item count or total height changes). Pan bounds are recomputed from it.
   */
  measureKey?: unknown;
}

/**
 * Wraps a {@link SectionGrid} in a pan-and-zoom viewport.
 *
 * Plain wheel pans (scroll up/down); Cmd/Ctrl + wheel and trackpad pinch zoom;
 * dragging the background pans (tiles are `data-no-pan`, so drag/resize still
 * works). Horizontal and vertical custom scrollbars appear only when the
 * scaled content overflows the viewport — i.e. driven by the zoom state.
 */
export const ZoomableSectionGrid = memo(function ZoomableSectionGrid({
  storageKey,
  measureKey,
  ...gridProps
}: ZoomableSectionGridProps) {
  const pz = usePanZoom({
    minScale: MIN_SCALE,
    maxScale: MAX_SCALE,
    paddingX: 40,
    paddingY: 80,
    storageKey,
  });

  // Card/viewport width drives the grid's column sizing — kept separate from the
  // (potentially much wider) free canvas so columns don't grow as items spread.
  const [viewportWidth, setViewportWidth] = useState(0);
  useEffect(() => {
    const el = pz.viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setViewportWidth(w);
    });
    ro.observe(el);
    setViewportWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [pz.viewportRef]);

  // Re-clamp pan bounds whenever the grid's content dimensions may have changed.
  useEffect(() => {
    pz.remeasure();
  }, [measureKey, pz]);

  return (
    <div className={styles.viewport} ref={pz.viewportRef}>
      <div className={styles.content} ref={pz.contentRef}>
        <PanZoomScaleProvider value={pz.scale}>
          <SectionGrid {...gridProps} scale={pz.scale} viewportWidth={viewportWidth} />
        </PanZoomScaleProvider>
      </div>

      <PanZoomScrollbar {...pz.scrollbar} />

      <div className={styles.zoomControls} data-no-pan>
        {!pz.isAtHome && (
          <button type="button" className={styles.resetBtn} onClick={pz.resetView} title="Reset view">
            reset view
          </button>
        )}
        <ZoomScrubber percentage={pz.zoomPercentage} onChange={pz.setZoomPercentage} />
      </div>
    </div>
  );
});
