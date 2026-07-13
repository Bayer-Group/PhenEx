import React, { forwardRef } from 'react';
import styles from './CohortCardViewer.module.css';

interface CohortCardViewerPinnedColsProps {
  /** Total width (px) of all pinned columns. */
  width: number;
  /** Optional header row rendered above the scrollable body (not translated). */
  header?: React.ReactNode;
  /** Bottom padding (px) to match the scroll panel's content padding. */
  bottomPadding?: number;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}

/**
 * Left panel holding the pinned columns. Vertically in sync with
 * CohortCardViewerScrollCols via direct scrollTop mirroring (no transform lag).
 * The forwarded ref points at the scrollable body div.
 */
export const CohortCardViewerPinnedCols = forwardRef<HTMLDivElement, CohortCardViewerPinnedColsProps>(
  ({ width, header, bottomPadding = 0, onScroll, children }, ref) => {
    return (
      <div className={styles.pinnedPanel} style={{ width: `${width}px`, minWidth: `${width}px` }}>
        {header}
        <div
          ref={ref}
          className={styles.pinnedBody}
          onScroll={onScroll}
          style={bottomPadding ? { paddingBottom: `${bottomPadding}px` } : undefined}
        >
          {children}
        </div>
      </div>
    );
  }
);

CohortCardViewerPinnedCols.displayName = 'CohortCardViewerPinnedCols';

