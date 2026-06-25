import { forwardRef, memo, useEffect, useMemo, useRef, useState } from 'react';
import { type CohortClassified, type KdeCurve } from '../types';
import { type SequentialRow, type ViewerEntry, CATEGORY_DESCRIPTIONS, getCategoryLabel } from '../studyRegistryUtils';
import { TimeToEventContent } from '../GraphsAndTables/ModalRenderers/TimeToEventContent';
import { Table2Content } from '../GraphsAndTables/ModalRenderers/Table2Content';
import { type TimeToEventCohort, type Table2Cohort } from '../GraphsAndTables/OutcomesChart';
import { StudyInfoCellRenderer } from '../GraphsAndTables/RowRenderers/StudyInfoCellRenderer';
import { BarChartCellRenderer } from '../GraphsAndTables/RowRenderers/BarChartCellRenderer';
import { CategoricalBarChartCellRenderer } from '../GraphsAndTables/RowRenderers/CategoricalBarChartCellRenderer';
import { NumericGraphCellRenderer } from '../GraphsAndTables/RowRenderers/NumericGraphCellRenderer';
import { BooleanCellLayout, CategoricalCellLayout, NumericCellLayout } from '../CellLayouts';

import { SimpleCustomScrollbar } from '../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import styles from './HorizontalCell.module.css';

// ── Props ───────────────────────────────────────────────────────────────

export interface HorizontalCellProps {
  entry: ViewerEntry;
  entries: ViewerEntry[];
  rows: SequentialRow[];
  isFocused: boolean;
  nearby: boolean;
  cohortDataMap: Record<string, CohortClassified[]>;
  finalCohortSizes?: Record<string, number | null>;
  tteCohorts?: TimeToEventCohort[];
  table2Cohorts?: Table2Cohort[];
  onNavigate: (index: number) => void;
  onNavigateToRow?: (row: SequentialRow) => void;
  onVerticalScroll?: (scrollTop: number, threshold: number) => void;
  initialScrollTop?: number;
  studyTitle?: string;
  studyDescription?: string;
}

// ── HorizontalCell ──────────────────────────────────────────────────────

const HorizontalCellInner = forwardRef<HTMLDivElement, HorizontalCellProps>(
  ({ entry, entries, rows, isFocused, nearby, cohortDataMap, finalCohortSizes, tteCohorts, table2Cohorts, onNavigate, onNavigateToRow, onVerticalScroll, initialScrollTop, studyTitle = '', studyDescription }, ref) => {
    const isSection = entry.kind === 'section';
    const isCategory = entry.kind === 'category';
    const reporter = entry.kind === 'row' ? entry.row.reporter : entry.reporter;
    const cellRows = entry.kind === 'section' ? entry.rows : entry.kind === 'row' ? [entry.row] : [];
    const title =
      entry.kind === 'row' ? (entry.row.registry?.display_name || entry.row.name)
        : entry.kind === 'section' ? entry.section
          : getCategoryLabel(entry.category);

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

    const renderCategoryContent = () => {
      if (entry.kind !== 'category') return null;
      const description = CATEGORY_DESCRIPTIONS[entry.category] ?? '';
      const sectionEntries = entries.filter(
        (e): e is Extract<ViewerEntry, { kind: 'section' }> =>
          e.kind === 'section' && e.category === entry.category,
      );
      return (
        <div className={styles.categoryBody}>
          {description && <p className={styles.categoryDescription}>{description}</p>}
          {sectionEntries.length > 0 && (
            <div className={styles.categorySectionList}>
              {sectionEntries.map((se) => (
                <button
                  key={se.key}
                  type="button"
                  className={styles.categorySectionLink}
                  onClick={(e) => { e.stopPropagation(); onNavigate(se.index); }}
                >
                  <span className={styles.categorySectionName}>{se.section}</span>
                  <span className={styles.categorySectionCount}>{se.rows.length}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      );
    };

    const renderContent = () => {
      if (!nearby) return null;
      if (isCategory) return renderCategoryContent();
      if (!isSection) return renderRowContent(cellRows[0]);
      // Multi-row section card: lightweight rendering using the same chart
      // renderers as CharacteristicsChart (no FlexLayout per row).
      return (
        <div className={styles.multiRowList}>
          {cellRows.map((row) => (
            <div
              key={row.index}
              className={styles.multiRowBlock}
              onClick={(e) => { e.stopPropagation(); onNavigateToRow?.(row); }}
            >
              <div className={styles.multiRowTitle}>
                {row.registry?.display_name || row.name}
              </div>
              <div className={styles.multiRowContent}>
                {renderSectionRow(row)}
              </div>
            </div>
          ))}
        </div>
      );
    };

    const renderSectionRow = (row: SequentialRow) => {
      console.log(cohortData, "this is cohort data")
      switch (row.rowType) {
        case 'boolean':
          return <BarChartCellRenderer data={{ name: row.name, _meta: { cohortData, finalCohortSizes } }} isModal />;
        case 'categorical':
          return <CategoricalBarChartCellRenderer baseName={row.name} cohortData={cohortData} finalCohortSizes={finalCohortSizes}/>;
        case 'numeric':
          return <NumericGraphCellRenderer name={row.name} cohortData={cohortData} kdeData={kdeData} />;
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
              onClick={(e) => { e.stopPropagation(); if (!isFocused) onNavigate(entry.index); }}
            >
              <div
                className={`${styles.cardTitle} ${isSection || isCategory ? styles.cardTitleSection : ''}`}
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
            marginTop={80}
            marginBottom={10}
            marginToEnd={-20}
            classNameThumb={styles.scrollBarThumb}
            classNameTrack={styles.scrollBarTrack}
            showOnHover={true}
          />
        </div>
      </div>
    );
  },
);

export const HorizontalCell = memo(HorizontalCellInner);
