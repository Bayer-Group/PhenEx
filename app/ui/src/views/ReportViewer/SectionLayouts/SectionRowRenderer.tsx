import { memo } from 'react';
import { type CohortClassified } from '../types';
import { type BarChartSpacer } from '../GraphsAndTables/RowRenderers/barChartShared';
import { type SequentialRow } from '../studyRegistryUtils';
import { type TimeToEventCohort, type Table2Cohort } from '../GraphsAndTables/OutcomesChart';
import { BarChartCellRendererCompact } from '../GraphsAndTables/RowRenderers/BarChartCellRendererCompact';
import { CategoricalBarChartCellRenderer } from '../GraphsAndTables/RowRenderers/CategoricalBarChartCellRenderer';
import { BoxPlotCellRenderer } from '../GraphsAndTables/RowRenderers/BoxPlotCellRenderer';
import { KaplanMeierCellRenderer } from '../GraphsAndTables/RowRenderers/KaplanMeierCellRenderer';
import { Table2CellRenderer } from '../GraphsAndTables/RowRenderers/Table2CellRenderer';

// ── Props ────────────────────────────────────────────────────────────────

export interface SectionRowRendererProps {
  row: SequentialRow;
  cohortData: CohortClassified[];
  finalCohortSizes?: Record<string, number | null>;
  spacers?: BarChartSpacer[];
  tteCohorts?: TimeToEventCohort[];
  table2Cohorts?: Table2Cohort[];
  /** Suppress the bar-chart header (e.g. consecutive boolean rows in a list). */
  hideBarChartHeader?: boolean;
  /** Bars expand to fill grid item height; body scrolls on overflow (grid context). */
  fillHeight?: boolean;
}

/**
 * Renders the chart/graph content for a single section row using the same
 * compact renderers regardless of whether the row is shown in the list view or
 * the grid view. This is the shared surface both section views build on.
 */
export const SectionRowRenderer = memo<SectionRowRendererProps>(({
  row,
  cohortData,
  finalCohortSizes,
  spacers,
  tteCohorts,
  table2Cohorts,
  hideBarChartHeader = false,
  fillHeight = false,
}) => {
  switch (row.rowType) {
    case 'boolean':
      return (
        <BarChartCellRendererCompact
          data={{ name: row.name, _meta: { cohortData, finalCohortSizes, spacers } }}
          isModal
          hideHeader={hideBarChartHeader}
          fillHeight={fillHeight}
        />
      );
    case 'categorical':
      return (
        <CategoricalBarChartCellRenderer
          baseName={row.name}
          cohortData={cohortData}
          finalCohortSizes={finalCohortSizes}
          orientation="vertical"
        />
      );
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
});

/** Human-readable label for a section row. */
export function sectionRowTitle(row: SequentialRow): string {
  return row.displayName || row.registry?.display_name || row.name;
}
