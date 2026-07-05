import { forwardRef, memo, useMemo, useRef } from 'react';
import { type CohortClassified, type CohortGroup, type KdeCurve, type CohortDescriptions, type ColorOverrides } from '../types';
import { type BarChartSpacer } from '../GraphsAndTables/RowRenderers/barChartShared';
import { type SequentialRow, type ViewerEntry, CATEGORY_DESCRIPTIONS, getCategoryLabel } from '../studyRegistryUtils';
import { TimeToEventContent } from '../GraphsAndTables/ModalRenderers/TimeToEventContent';
import { Table2Content } from '../GraphsAndTables/ModalRenderers/Table2Content';
import { type TimeToEventCohort, type Table2Cohort } from '../GraphsAndTables/OutcomesChart';
import { StudyInfoCellRenderer } from '../GraphsAndTables/RowRenderers/StudyInfoCellRenderer';
import { BooleanCellLayout, CategoricalCellLayout, NumericCellLayout } from '../CellLayouts';
import { SectionCellContent } from '../SectionLayouts/SectionCellContent';
import { getSectionLayoutId } from '../SectionLayouts/sectionLayoutStore';
import { LayoutControls } from '../SavedLayouts/LayoutControls';

import { SimpleCustomScrollbar } from '../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import styles from './HorizontalCell.module.css';
import { AttritionChart } from '../GraphsAndTables/AttritionChart';

// ── Props ───────────────────────────────────────────────────────────────

export interface HorizontalCellProps {
  entry: ViewerEntry;
  entries: ViewerEntry[];
  rows: SequentialRow[];
  isFocused: boolean;
  nearby: boolean;
  cohortDataMap: Record<string, CohortClassified[]>;
  finalCohortSizes?: Record<string, number | null>;
  spacers?: BarChartSpacer[];
  tteCohorts?: TimeToEventCohort[];
  table2Cohorts?: Table2Cohort[];
  onNavigate: (index: number) => void;
  onNavigateToRow?: (row: SequentialRow) => void;
  onVerticalScroll?: (scrollTop: number, threshold: number) => void;
  initialScrollTop?: number;
  studyTitle?: string;
  studyDescription?: string;
  waterfallData: Record<string, unknown>;
  groups: CohortGroup[];
  cohortDescriptions?: CohortDescriptions;
  colorOverrides?: ColorOverrides;
  onSetColor?: (cohortName: string, color: string) => void;
}

// ── HorizontalCell ──────────────────────────────────────────────────────

const HorizontalCellInner = forwardRef<HTMLDivElement, HorizontalCellProps>(
  ({ entry, entries, rows, isFocused, nearby, cohortDataMap, finalCohortSizes, spacers, tteCohorts, table2Cohorts, onNavigate, onNavigateToRow, initialScrollTop, studyTitle = '', studyDescription, waterfallData, groups, cohortDescriptions, onSetColor }, ref) => {
    const isSection = entry.kind === 'section';
    const isCategory = entry.kind === 'category';
    const reporter = entry.kind === 'row' ? entry.row.reporter : entry.reporter;
    const cellRows = entry.kind === 'section' ? entry.rows : entry.kind === 'row' ? [entry.row] : [];
    const title =
      entry.kind === 'row' ? (entry.row.displayName || entry.row.registry?.display_name || entry.row.name)
        : entry.kind === 'section' ? entry.section
          : getCategoryLabel(entry.category);

    const isAttrition = entry.kind === 'category' && entry.category === 'attrition';
    const cohortData = isAttrition
      ? (cohortDataMap['table1'] ?? [])
      : cohortDataMap[reporter] ?? [];
    const verticalScrollRef = useRef<HTMLDivElement>(null);
    const initialScrollTopRef = useRef(initialScrollTop ?? 0);
    initialScrollTopRef.current = initialScrollTop ?? 0;


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
          return <BooleanCellLayout row={row} cohortData={cohortData} finalCohortSizes={finalCohortSizes} spacers={spacers} />;
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

    const renderAttritionContent = () => {
      return (
        <div className={styles.attritionBody}>
          <AttritionChart
            cohortData={cohortData}
            waterfall={waterfallData}
            groups={groups}
            spacers={spacers}
            cohortDescriptions={cohortDescriptions}
            onSetColor={onSetColor}
          />
        </div>
      );
    };

    const renderCategoryContent = () => {
      if (entry.kind !== 'category') return null;
      else if (entry.category === 'attrition') return renderAttritionContent();
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
      // Multi-row section card: delegates to the list/grid view toggle. Both
      // views share the same underlying chart renderers.
      if (entry.kind !== 'section') return null;
      return (
        <SectionCellContent
          sectionId={getSectionLayoutId(entry)}
          rows={cellRows}
          cohortData={cohortData}
          finalCohortSizes={finalCohortSizes}
          spacers={spacers}
          tteCohorts={tteCohorts}
          table2Cohorts={table2Cohorts}
          onNavigateToRow={onNavigateToRow}
        />
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
              {isFocused && entry.kind === 'section' && (
                <LayoutControls sectionId={getSectionLayoutId(entry)} rows={cellRows} />
              )}
              <div
                className={`${styles.cardTitle} ${isSection || isCategory ? styles.cardTitleSection : ''}`}
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
