import { memo, useMemo } from 'react';
import { type CohortClassified } from '../types';
import { type BarChartSpacer } from '../GraphsAndTables/RowRenderers/barChartShared';
import { type SequentialRow } from '../studyRegistryUtils';
import { type TimeToEventCohort, type Table2Cohort } from '../GraphsAndTables/OutcomesChart';
import { SectionGridContent } from './SectionGridContent';
import {
  useSectionLayouts,
  buildDefaultLayoutItems,
  defaultLayoutId,
  defaultLayoutName,
  isDefaultLayoutId,
  defaultColumnsFromId,
  type SectionLayout,
} from './sectionLayoutStore';

// ── Props ────────────────────────────────────────────────────────────────

export interface SectionCellContentProps {
  /** Stable id used to look up / persist this section's layouts. */
  sectionId: string;
  rows: SequentialRow[];
  cohortData: CohortClassified[];
  finalCohortSizes?: Record<string, number | null>;
  spacers?: BarChartSpacer[];
  tteCohorts?: TimeToEventCohort[];
  table2Cohorts?: Table2Cohort[];
  onNavigateToRow?: (row: SequentialRow) => void;
  onRenameRow?: (name: string, displayName: string) => void;
  /** Responsive default column count derived from the card width. */
  defaultColumns?: number;
}

/**
 * Always renders a grid view. Falls back to a default layout derived from the
 * current rows when no persisted layout exists for this section.
 */
export const SectionCellContent = memo<SectionCellContentProps>((props) => {
  const { sectionId, rows, cohortData, defaultColumns = 3, ...rest } = props;
  const { activeLayout, activeLayoutId, hiddenKeys } = useSectionLayouts(sectionId);

  const visibleRows = hiddenKeys.size > 0 ? rows.filter((r) => !hiddenKeys.has(r.name)) : rows;

  // When a default view is active its id encodes the column count; otherwise
  // fall back to the responsive default. Named/draft layouts ignore this.
  const activeColumns = isDefaultLayoutId(activeLayoutId)
    ? defaultColumnsFromId(activeLayoutId!)
    : defaultColumns;

  const defaultLayout = useMemo<SectionLayout>(
    () => ({
      id: defaultLayoutId(activeColumns),
      name: defaultLayoutName(activeColumns),
      items: buildDefaultLayoutItems(rows.map((r) => r.name), cohortData.length, activeColumns),
      columnsPerRow: activeColumns,
    }),
    // Rebuild only when the row set, cohort count, or active column count change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows.map((r) => r.name).join('\0'), cohortData.length, activeColumns],
  );

  const layout = activeLayout ?? defaultLayout;

  return <SectionGridContent sectionId={sectionId} layout={layout} rows={visibleRows} cohortData={cohortData} {...rest} />;
});
