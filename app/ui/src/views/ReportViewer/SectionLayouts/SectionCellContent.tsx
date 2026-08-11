import { memo, useMemo } from 'react';
import { type CohortClassified } from '../types';
import { type BarChartSpacer, SPACER_UNIT_PX } from '../GraphsAndTables/RowRenderers/barChartShared';
import { type SequentialRow } from '../studyRegistryUtils';
import { type TimeToEventCohort, type Table2Cohort } from '../GraphsAndTables/OutcomesChart';
import { SectionGridContent } from './SectionGridContent';
import { sectionRowTitle } from './SectionRowRenderer';
import {
  useSectionLayouts,
  buildContentLayoutItems,
  contentTileRows,
  GRID_COLUMNS,
  GRID_GAP,
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
  /** Measured card width (px), used to size default tile heights. */
  contentWidth?: number;
}

/** Pixel width of one tile spanning `GRID_COLUMNS / nCols` columns. */
function tileWidthPx(contentWidth: number, nCols: number): number {
  if (contentWidth <= 0) return 0;
  const w = Math.floor(GRID_COLUMNS / nCols);
  return (contentWidth - GRID_GAP * (nCols - 1)) * (w / GRID_COLUMNS);
}

/**
 * Always renders a grid view. Falls back to a default layout derived from the
 * current rows when no persisted layout exists for this section.
 */
export const SectionCellContent = memo<SectionCellContentProps>((props) => {
  const { sectionId, rows, cohortData, defaultColumns = 3, contentWidth = 0, spacers, ...rest } = props;
  const { activeLayout, activeLayoutId, hiddenKeys, globalColumnCount } = useSectionLayouts(sectionId);

  const visibleRows = hiddenKeys.size > 0 ? rows.filter((r) => !hiddenKeys.has(r.name)) : rows;

  // Named layouts use their own column count; "All" mode uses the shared global count.
  const activeColumns = activeLayout?.columnsPerRow ?? globalColumnCount ?? defaultColumns;

  const spacersPx = useMemo(
    () => (spacers ?? []).reduce((sum, s) => sum + 10 + (s.size - 1) * SPACER_UNIT_PX, 0),
    [spacers],
  );

  const defaultLayout = useMemo<SectionLayout>(() => {
    const cohortCount = cohortData.length;
    const widthPx = tileWidthPx(contentWidth, activeColumns);
    const items = buildContentLayoutItems(
      rows.map((r) => ({
        key: r.name,
        h: contentTileRows(r.rowType, cohortCount, sectionRowTitle(r), widthPx, spacersPx),
      })),
      activeColumns,
    );
    return {
      id: '__auto__',
      name: 'All',
      items,
      columnsPerRow: activeColumns,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((r) => `${r.name}|${r.rowType}|${sectionRowTitle(r)}`).join('\0'), cohortData.length, activeColumns, contentWidth, spacersPx]);

  const isDefault = activeLayoutId === null;
  const layout = activeLayout ?? defaultLayout;

  return (
    <SectionGridContent
      sectionId={sectionId}
      layout={layout}
      isDefault={isDefault}
      rows={visibleRows}
      cohortData={cohortData}
      spacers={spacers}
      contentWidth={contentWidth}
      {...rest}
    />
  );
});
