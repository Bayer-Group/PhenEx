import { forwardRef, memo, useMemo, useRef } from 'react';
import { type CohortClassified, type CohortGroup, type KdeCurve, type CohortDescriptions, type ColorOverrides } from '../types';
import { type BarChartSpacer } from '../GraphsAndTables/RowRenderers/barChartShared';
import { type SequentialRow, type ViewerEntry, CATEGORY_DESCRIPTIONS, getCategoryLabel } from '../studyRegistryUtils';
import { TimeToEventContent } from '../GraphsAndTables/ModalRenderers/TimeToEventContent';
import { Table2Content } from '../GraphsAndTables/ModalRenderers/Table2Content';
import { type TimeToEventCohort, type Table2Cohort } from '../GraphsAndTables/OutcomesChart';
import { StudyInfoCellRenderer } from '../GraphsAndTables/RowRenderers/StudyInfoCellRenderer';
import { BarChartCellRendererCompact } from '../GraphsAndTables/RowRenderers/BarChartCellRendererCompact';
import { CategoricalBarChartCellRenderer } from '../GraphsAndTables/RowRenderers/CategoricalBarChartCellRenderer';
import { BoxPlotCellRenderer } from '../GraphsAndTables/RowRenderers/BoxPlotCellRenderer';
import { KaplanMeierCellRenderer } from '../GraphsAndTables/RowRenderers/KaplanMeierCellRenderer';
import { Table2CellRenderer } from '../GraphsAndTables/RowRenderers/Table2CellRenderer';
import { BooleanCellLayout, CategoricalCellLayout, NumericCellLayout } from '../CellLayouts';

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
  ({ entry, entries, rows, isFocused, nearby, cohortDataMap, finalCohortSizes, spacers, tteCohorts, table2Cohorts, onNavigate, onNavigateToRow, initialScrollTop, studyTitle = '', studyDescription, waterfallData, groups, cohortDescriptions, colorOverrides, onSetColor }, ref) => {
    const isSection = entry.kind === 'section';
    const isCategory = entry.kind === 'category';
    const reporter = entry.kind === 'row' ? entry.row.reporter : entry.reporter;
    const cellRows = entry.kind === 'section' ? entry.rows : entry.kind === 'row' ? [entry.row] : [];
    const title =
      entry.kind === 'row' ? (entry.row.registry?.display_name || entry.row.name)
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
      // Multi-row section card: lightweight rendering using the same chart
      // renderers as CharacteristicsChart (no FlexLayout per row).
      return (
        <div className={styles.multiRowList}>
          {cellRows.map((row, index) => {
            const hideBarChartHeader = row.rowType === 'boolean'
              && index > 0
              && cellRows[index - 1].rowType === 'boolean';

            return (
            <div
              key={row.index}
              className={styles.multiRowBlock}
              onClick={(e) => { e.stopPropagation(); onNavigateToRow?.(row); }}
            >
              <div className={styles.multiRowTitle}>
                {row.registry?.display_name || row.name}
              </div>
              <div className={styles.multiRowContent}>
                {renderSectionRow(row, hideBarChartHeader)}
              </div>
            </div>
            );
          })}
        </div>
      );
    };

    const renderSectionRow = (row: SequentialRow, hideBarChartHeader = false) => {
      switch (row.rowType) {
        case 'boolean':
          return (
            <BarChartCellRendererCompact
              data={{ name: row.name, _meta: { cohortData, finalCohortSizes, spacers } }}
              isModal
              hideHeader={hideBarChartHeader}
            />
          );
        case 'categorical':
          return <CategoricalBarChartCellRenderer baseName={row.name} cohortData={cohortData} finalCohortSizes={finalCohortSizes} orientation="vertical"/>;
        case 'numeric': {
          let lo = Infinity, hi = -Infinity;
          for (const cd of cohortData) {
            const r = cd.data.rows.find((r) => r.Name === row.name);
            if (!r) continue;
            if (r.Min != null && r.Min < lo) lo = r.Min;
            if (r.Max != null && r.Max > hi) hi = r.Max;
          }
          if (!isFinite(lo)) { lo = 0; hi = 1; }
          return <BoxPlotCellRenderer name={row.name} cohortData={cohortData} xMin={lo} xMax={hi} spacers={spacers} />;
        }
        case 'time_to_event': {
          const kmCurves = (tteCohorts ?? [])
            .map((c) => ({
              color: c.color,
              cohortName: c.name,
              steps: c.timeToEvent.filter((r) => r.Outcome === row.name),
            }))
            .filter((c) => c.steps.length > 0);
          return <KaplanMeierCellRenderer curves={kmCurves} mode="compact" />;
        }
        case 'table2': {
          const t2cohorts = (table2Cohorts ?? []).map((c) => ({
            name: c.name,
            color: c.color,
            table2: c.table2,
          }));
          return <Table2CellRenderer outcome={row.name} cohorts={t2cohorts} />;
        }
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
