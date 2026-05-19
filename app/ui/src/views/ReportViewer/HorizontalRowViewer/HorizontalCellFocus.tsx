import { forwardRef, useMemo, useRef } from 'react';
import { type KdeCurve } from '../types';
import { type HorizontalCellProps, CardInfoSection, CommentsColumn, RowContent } from './HorizontalCellShared';
import { SimpleCustomScrollbar } from '../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import styles from './HorizontalRowViewer.module.css';

/**
 * Focus mode cell: comments positioned to the right of the card.
 * Used when the left panel is hidden (full horizontal space available).
 * Shows cohort info labels in bar charts.
 */
export const HorizontalCellFocus = forwardRef<HTMLDivElement, HorizontalCellProps>(
  ({ row, rows, isFocused, nearby, desiredTop, cohortDataMap, finalCohortSizes, tteCohorts, table2Cohorts, onNavigate, commentsOpen }, ref) => {
    const cohortData = cohortDataMap[row.reporter] ?? [];
    const verticalScrollRef = useRef<HTMLDivElement>(null);
    const availableTteOutcomes = useMemo(
      () => rows
        .filter((c) => c.reporter === row.reporter && c.rowType === 'time_to_event')
        .map((c) => c.name),
      [rows, row.reporter],
    );
    const kdeData = useMemo(() => {
      const result: Record<string, Record<string, KdeCurve>> = {};
      for (const cd of cohortData) {
        if (cd.data.kdes) result[cd.name] = cd.data.kdes;
      }
      return result;
    }, [cohortData]);

    const comments = useMemo(() => (row.registry?.comments ?? []).filter((c) => c.text && c.type !== 'rule_based'), [row.registry]);
    const hasComments = comments.length > 0;
    const shouldShowComments = commentsOpen && hasComments;

    return (
      <div
        ref={ref}
        className={styles.cell}
        style={{ '--desired-top': desiredTop } as React.CSSProperties}
      >
        <div className={styles.cellInner}>
          <div className={styles.cardColumn}>
            <div ref={verticalScrollRef} className={`${styles.verticalWrapper} ${shouldShowComments ? styles.verticalWrapperCommentsOpen : ''}`}>
              <div
                className={`${styles.card} ${isFocused ? styles.cardFocused : styles.cardNeighbour}`}
                onClick={(e) => { e.stopPropagation(); if (!isFocused) onNavigate(row.index); }}
              >
                <div className={styles.cardTitle}>
                  {row.registry?.display_name || row.name}
                </div>
                <CardInfoSection row={row} isOpen={commentsOpen} />
                <div className={styles.cardContent}>
                  {nearby ? <RowContent row={row} cohortData={cohortData} kdeData={kdeData} finalCohortSizes={finalCohortSizes} tteCohorts={tteCohorts} table2Cohorts={table2Cohorts} availableTteOutcomes={availableTteOutcomes} showCohortInfo /> : null}
                </div>
              </div>
            </div>
            <SimpleCustomScrollbar
              targetRef={verticalScrollRef}
              orientation="vertical"
              marginTop={130}
              marginBottom={35}
              marginToEnd={5}
              classNameThumb={styles.verticalScrollbarThumb}
            />
            <CommentsColumn comments={comments} isOpen={shouldShowComments} />
          </div>
        </div>
      </div>
    );
  },
);
