import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { type CohortClassified, type KdeCurve } from '../types';
import { type SequentialRow } from '../studyRegistryUtils';
import { TimeToEventContent } from '../GraphsAndTables/ModalRenderers/TimeToEventContent';
import { Table2Content } from '../GraphsAndTables/ModalRenderers/Table2Content';
import { type TimeToEventCohort, type Table2Cohort } from '../GraphsAndTables/OutcomesChart';
import { StudyInfoCellRenderer } from '../GraphsAndTables/RowRenderers/StudyInfoCellRenderer';
import { BooleanCellLayout, CategoricalCellLayout, NumericCellLayout } from '../CellLayouts';

import { SimpleCustomScrollbar } from '../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import styles from './HorizontalCell.module.css';

// ── Props ───────────────────────────────────────────────────────────────

export interface HorizontalCellProps {
  row: SequentialRow;
  rows: SequentialRow[];
  isFocused: boolean;
  nearby: boolean;
  cohortDataMap: Record<string, CohortClassified[]>;
  finalCohortSizes?: Record<string, number | null>;
  tteCohorts?: TimeToEventCohort[];
  table2Cohorts?: Table2Cohort[];
  onNavigate: (index: number) => void;
  onVerticalScroll?: (scrollTop: number, threshold: number) => void;
  initialScrollTop?: number;
  studyTitle?: string;
  studyDescription?: string;
}

// ── HorizontalCell ──────────────────────────────────────────────────────

export const HorizontalCell = forwardRef<HTMLDivElement, HorizontalCellProps>(
  ({ row, rows, isFocused, nearby, cohortDataMap, finalCohortSizes, tteCohorts, table2Cohorts, onNavigate, onVerticalScroll, initialScrollTop, studyTitle = '', studyDescription }, ref) => {
    const cohortData = cohortDataMap[row.reporter] ?? [];
    const verticalScrollRef = useRef<HTMLDivElement>(null);
    const [titleHidden, setTitleHidden] = useState(false);
    const initialScrollTopRef = useRef(initialScrollTop ?? 0);
    initialScrollTopRef.current = initialScrollTop ?? 0;

    useEffect(() => {
      const el = verticalScrollRef.current;
      if (!el || !isFocused) return;
      el.scrollTop = initialScrollTopRef.current;
      const threshold = 10;
      const handler = () => {
        const hidden = el.scrollTop > threshold;
        setTitleHidden(hidden);
        onVerticalScroll?.(el.scrollTop, threshold);
      };
      el.addEventListener('scroll', handler, { passive: true });
      handler();
      return () => el.removeEventListener('scroll', handler);
    }, [isFocused, onVerticalScroll]);

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

    const renderContent = () => {
      if (!nearby) return null;
      switch (row.rowType) {
        case 'boolean':
          return <BooleanCellLayout row={row} cohortData={cohortData} finalCohortSizes={finalCohortSizes} />;
        case 'categorical':
          return <CategoricalCellLayout row={row} cohortData={cohortData} finalCohortSizes={finalCohortSizes} />;
        case 'numeric':
          return <NumericCellLayout row={row} cohortData={cohortData} kdeData={kdeData} finalCohortSizes={finalCohortSizes} />;
        case 'time_to_event':
          return <TimeToEventContent outcome={row.name} cohorts={tteCohorts ?? []} availableOutcomes={availableTteOutcomes} />;
        case 'table2':
          return <Table2Content outcome={row.name} cohorts={table2Cohorts ?? []} />;
        case 'study_info':
          return <StudyInfoCellRenderer title={studyTitle} description={studyDescription} />;
        default:
          return null;
      }
    };

    return (
      <div ref={ref} className={styles.cell}>
        <div className={styles.cardColumnInner}>
          <div ref={verticalScrollRef} className={styles.verticalWrapper}>
            <div
              className={`${styles.card} ${isFocused ? styles.cardFocused : styles.cardNeighbour}`}
              onClick={(e) => { e.stopPropagation(); if (!isFocused) onNavigate(row.index); }}
            >
              <div className={styles.cardTitle} style={{ opacity: titleHidden ? 0 : 1 }}>
                {row.registry?.display_name || row.name}
              </div>
              <div className={styles.cardContent}>
                {renderContent()}
              </div>
            </div>
          </div>
          <SimpleCustomScrollbar
            targetRef={verticalScrollRef}
            orientation="vertical"
            marginTop={30}
            marginBottom={10}
            marginToEnd={10}
            classNameThumb={styles.scrollBarThumb}
            classNameTrack={styles.scrollBarTrack}
            showOnHover={true}
          />
        </div>
      </div>
    );
  },
);
