import React, { forwardRef, useCallback, useEffect, useRef } from 'react';
import styles from './CohortCardViewer.module.css';

interface CohortCardViewerPinnedColsProps {
  /** Total width (px) of all pinned columns. */
  width: number;
  /**
   * Header row rendered inside the card, above the rows. Becomes sticky at the
   * top of the scrollable body once the cohort-meta section scrolls out of view.
   */
  header?: React.ReactNode;
  /** Cohort name displayed at the top of the card (scrolls away). */
  cohortName?: string;
  /** Cohort description displayed below the name (scrolls away). */
  description?: string;
  /** Bottom padding (px) to match the scroll panel's content padding. */
  bottomPadding?: number;
  /** Background color of the chin strip — matches the last row's color. */
  chinColor?: string;
  /**
   * Called whenever the cohort-meta section's rendered height changes.
   * The scroll panel uses this value to insert an equal-height spacer so
   * both header rows stay vertically locked at all scroll positions.
   */
  onMetaHeightChange?: (height: number) => void;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}

/**
 * Left panel holding the pinned columns. Vertically in sync with
 * CohortCardViewerScrollCols via direct scrollTop mirroring (no transform lag).
 * The forwarded ref points at the scrollable body div.
 *
 * The card visually encompasses the cohort-meta section (name + description),
 * the sticky header row, and the scrollable rows. As the user scrolls, the
 * cohort-meta section scrolls out of view and the header row pins at the top.
 */
export const CohortCardViewerPinnedCols = forwardRef<HTMLDivElement, CohortCardViewerPinnedColsProps>(
  ({ width, header, cohortName, description, bottomPadding = 0, chinColor, onMetaHeightChange, onScroll, children }, ref) => {
    const metaRef = useRef<HTMLDivElement>(null);

    // Measure the full offset from the card top to the bottom edge of the meta
    // section (offsetTop accounts for margin-top; offsetHeight is the element
    // height). The scroll panel uses this total to insert a matching spacer.
    const notifyHeight = useCallback(() => {
      const el = metaRef.current;
      const h = el ? el.offsetTop + el.offsetHeight : 0;
      onMetaHeightChange?.(h);
    }, [onMetaHeightChange]);

    useEffect(() => {
      notifyHeight();
      if (!metaRef.current) return;
      const ro = new ResizeObserver(notifyHeight);
      ro.observe(metaRef.current);
      return () => ro.disconnect();
    }, [notifyHeight, cohortName, description]);

    return (
      <div className={styles.pinnedPanel} style={{ width: `${width}px`, minWidth: `${width}px` }}>
        <div
          ref={ref}
          className={styles.pinnedBody}
          onScroll={onScroll}
          style={bottomPadding ? { paddingBottom: `${bottomPadding}px` } : undefined}
        >
          <div className={styles.pinnedCard}>
            {(cohortName || description) && (
              <div ref={metaRef} className={styles.pinnedCohortMeta}>
                {cohortName && <div className={styles.pinnedCohortName}>{cohortName}</div>}
                {description && <div className={styles.pinnedCohortDescription}>{description}</div>}
              </div>
            )}
            {header}
            {children}
            <div className={styles.pinnedChin} style={chinColor ? { backgroundColor: chinColor } : undefined} />
          </div>
        </div>
      </div>
    );
  }
);

CohortCardViewerPinnedCols.displayName = 'CohortCardViewerPinnedCols';

