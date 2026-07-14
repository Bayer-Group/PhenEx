import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
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
  /** Called when the user commits a new cohort name (on blur or Enter). */
  onNameChange?: (name: string) => void;
  /** Called when the user commits a new cohort description (on blur). */
  onDescriptionChange?: (description: string) => void;
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
  ({ width, header, cohortName, description, bottomPadding = 0, chinColor, onMetaHeightChange, onScroll, onNameChange, onDescriptionChange, children }, ref) => {
    const metaRef = useRef<HTMLDivElement>(null);
    const descriptionRef = useRef<HTMLTextAreaElement>(null);
    const [localName, setLocalName] = useState(cohortName ?? '');
    const [localDescription, setLocalDescription] = useState(description ?? '');

    // Sync local state when props change externally (e.g. cohort switch)
    useEffect(() => { setLocalName(cohortName ?? ''); }, [cohortName]);
    useEffect(() => { setLocalDescription(description ?? ''); }, [description]);

    // Auto-resize the textarea to fit its content
    useEffect(() => {
      const el = descriptionRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }, [localDescription]);

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
            {cohortName && (
              <div ref={metaRef} className={styles.pinnedCohortMeta}>
                <input
                  className={styles.pinnedCohortNameInput}
                  value={localName}
                  onChange={e => setLocalName(e.target.value)}
                  onBlur={() => onNameChange?.(localName)}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                />
                <textarea
                  ref={descriptionRef}
                  className={styles.pinnedCohortDescriptionInput}
                  value={localDescription}
                  placeholder="add a description"
                  onChange={e => setLocalDescription(e.target.value)}
                  onBlur={() => onDescriptionChange?.(localDescription)}
                />
              </div>
            )}
            {header}
            {children}
            <div className={styles.pinnedChin} />
          </div>
        </div>
      </div>
    );
  }
);

CohortCardViewerPinnedCols.displayName = 'CohortCardViewerPinnedCols';

