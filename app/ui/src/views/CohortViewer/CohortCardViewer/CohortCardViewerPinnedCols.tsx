import React, { forwardRef } from 'react';
import styles from './CohortCardViewer.module.css';

interface CohortCardViewerPinnedColsProps {
  /** Total width (px) of all pinned columns. */
  width: number;
  /** Optional header row rendered above the scrollable pinned content (not translated). */
  header?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Left, non-scrolling panel that holds the pinned columns
 * (selection, drag handle, type, name, phenotype). Rendered as a sibling of
 * CohortCardViewerScrollCols; the two are kept row-aligned by shared row heights,
 * and vertically in sync via a transform driven by the scroll panel.
 *
 * The forwarded ref points at the inner content element that gets translated.
 */
export const CohortCardViewerPinnedCols = forwardRef<HTMLDivElement, CohortCardViewerPinnedColsProps>(
  ({ width, header, children }, ref) => {
    return (
      <div className={styles.pinnedPanel} style={{ width: `${width}px`, minWidth: `${width}px` }}>
        {header}
        <div className={styles.pinnedScrollArea}>
          <div ref={ref} className={styles.pinnedContent}>
            {children}
          </div>
        </div>
      </div>
    );
  }
);

CohortCardViewerPinnedCols.displayName = 'CohortCardViewerPinnedCols';

