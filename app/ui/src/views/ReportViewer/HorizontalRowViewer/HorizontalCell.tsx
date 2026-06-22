import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { type CohortClassified, type KdeCurve } from '../types';
import { type SequentialRow, type ViewerEntry } from '../studyRegistryUtils';
import { TimeToEventContent } from '../GraphsAndTables/ModalRenderers/TimeToEventContent';
import { Table2Content } from '../GraphsAndTables/ModalRenderers/Table2Content';
import { type TimeToEventCohort, type Table2Cohort } from '../GraphsAndTables/OutcomesChart';
import { StudyInfoCellRenderer } from '../GraphsAndTables/RowRenderers/StudyInfoCellRenderer';
import { BooleanCellLayout, CategoricalCellLayout, NumericCellLayout } from '../CellLayouts';

import { SimpleCustomScrollbar } from '../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import styles from './HorizontalCell.module.css';

// ── Props ───────────────────────────────────────────────────────────────

export interface HorizontalCellProps {
  entry: ViewerEntry;
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
  ({ entry, rows, isFocused, nearby, cohortDataMap, finalCohortSizes, tteCohorts, table2Cohorts, onNavigate, onVerticalScroll, initialScrollTop, studyTitle = '', studyDescription }, ref) => {
    const isSection = entry.kind === 'section';
    const reporter = entry.kind === 'row' ? entry.row.reporter : entry.reporter;
    const cellRows = entry.kind === 'row' ? [entry.row] : entry.rows;
    const title = entry.kind === 'row' ? (entry.row.registry?.display_name || entry.row.name) : entry.section;

    const cohortData = cohortDataMap[reporter] ?? [];
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
        .filter((c) => c.reporter === reporter && c.rowType === 'time_to_event')
        .map((c) => c.name),
      [rows, reporter],
    );

    const kdeData = useMemo(() => {
      const result: Record<string, Record<string, KdeCurve>> = {};
      for (const cd of cohortData) {
        if (cd.data.kdes) result[cd.name] = cd.data.kdes;
      }
      return result;
    }, [cohortData]);

    const renderRowContent = (row: SequentialRow) => {
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

    const renderContent = () => {
      if (!nearby) return null;
      if (!isSection) return renderRowContent(cellRows[0]);
      // Multi-row cell: stack each row of the section vertically, each in a
      // bounded block so its FlexLayout-based content renders at full size.
      // A section entry is immediately followed by its row entries, so the
      // i-th row's entry index is entry.index + 1 + i.
      return (
        <div className={styles.multiRowList}>
          {cellRows.map((row, i) => (
            <div key={row.index} className={styles.multiRowBlock}>
              <div
                className={styles.multiRowTitle}
                onClick={(e) => { e.stopPropagation(); onNavigate(entry.index + 1 + i); }}
              >
                {row.registry?.display_name || row.name}
              </div>
              <div className={styles.multiRowContent}>
                {renderRowContent(row)}
              </div>
            </div>
          ))}
        </div>
      );
    };

    return (
      <div ref={ref} className={styles.cell}>
        <div className={styles.cardColumnInner}>
          <div ref={verticalScrollRef} className={styles.verticalWrapper}>
            <div
              className={`${styles.card} ${isFocused ? styles.cardFocused : styles.cardNeighbour}`}
              onClick={(e) => { e.stopPropagation(); if (!isFocused) onNavigate(entry.index); }}
            >
              <div
                className={`${styles.cardTitle} ${isSection ? styles.cardTitleSection : ''}`}
                style={{ opacity: titleHidden ? 0 : 1 }}
              >
                {title}
              </div>
              <div className={isSection ? styles.cardContentSection : styles.cardContent}>
                {renderContent()}
              </div>
            </div>
          </div>
          <SimpleCustomScrollbar
            targetRef={verticalScrollRef}
            orientation="vertical"
            marginTop={30}
            marginBottom={10}
            marginToEnd={0}
            classNameThumb={styles.scrollBarThumb}
            classNameTrack={styles.scrollBarTrack}
            showOnHover={true}
          />
        </div>
      </div>
    );
  },
);
