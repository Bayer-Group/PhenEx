import { forwardRef, useMemo, useRef } from 'react';
import { type KdeCurve } from '../types';
import { type HorizontalCellProps, CardInfoSection, RowContent } from './HorizontalCellShared';
import { SimpleCustomScrollbar } from '../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import styles from './HorizontalRowViewer.module.css';

/**
 * Compact mode cell: comments rendered above the card in a vertical scroll.
 * Used when the left panel is shown (less horizontal space).
 * Hides cohort info labels in bar charts.
 */
export const HorizontalCellCompact = forwardRef<HTMLDivElement, HorizontalCellProps>(
  ({ row, rows, isFocused, nearby, desiredTop, cohortDataMap, finalCohortSizes, tteCohorts, table2Cohorts, onNavigate }, ref) => {
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

    return (
      <div
        ref={ref}
        className={styles.cell}
        style={{ '--desired-top': desiredTop } as React.CSSProperties}
      >
        <div className={styles.cellInner}>
          <div className={styles.cardColumnCompact}>
            <div ref={verticalScrollRef} className={styles.verticalWrapperCompact}>
              <div
                className={`${styles.card} ${isFocused ? styles.cardFocused : styles.cardNeighbour}`}
                onClick={(e) => { e.stopPropagation(); if (!isFocused) onNavigate(row.index); }}
              >
                <div className={styles.cardTitle}>
                  {row.registry?.display_name || row.name}
                </div>
                <CardInfoSection row={row} />
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
              marginToEnd={10}
              classNameThumb={styles.verticalScrollbarThumb}
            />
          </div>
        </div>
      </div>
    );
  },
);
