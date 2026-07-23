import React, { forwardRef } from 'react';
import styles from './CohortCardViewer.module.css';

interface CohortCardViewerScrollColsProps {
  /** Total width (px) of all scrollable columns (drives horizontal overflow). */
  contentWidth: number;
  bottomPadding?: number;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  onWheel?: (e: React.WheelEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}

/**
 * Right, horizontally-scrolling panel that holds the non-pinned columns.
 * Sits to the right of CohortCardViewerPinnedCols and shares row heights with it
 * so the two halves read as continuous rows.
 */
export const CohortCardViewerScrollCols = forwardRef<HTMLDivElement, CohortCardViewerScrollColsProps>(
  ({ contentWidth, bottomPadding = 0, onScroll, onWheel, children }, ref) => {
    return (
      <div ref={ref} className={styles.scrollPanel} onScroll={onScroll} onWheel={onWheel}>
        <div
          className={styles.scrollContent}
          style={{ width: `${contentWidth}px`, paddingBottom: `${bottomPadding}px` }}
        >
          {children}
        </div>
      </div>
    );
  }
);

CohortCardViewerScrollCols.displayName = 'CohortCardViewerScrollCols';
