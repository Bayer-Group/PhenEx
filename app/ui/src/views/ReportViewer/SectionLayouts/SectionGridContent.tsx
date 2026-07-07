import { memo, useCallback, useEffect, useMemo } from 'react';
import { type CohortClassified } from '../types';
import { type BarChartSpacer } from '../GraphsAndTables/RowRenderers/barChartShared';
import { type SequentialRow } from '../studyRegistryUtils';
import { type TimeToEventCohort, type Table2Cohort } from '../GraphsAndTables/OutcomesChart';
import { SectionRowRenderer, SectionRowTitle, sectionRowTitle } from './SectionRowRenderer';
import { SectionGrid, type SectionGridRenderItem } from './SectionGrid';
import { restackForTileHeight } from './CleanupGridLayout';
import { type SectionLayout, type GridItem, defaultTileRows, useSectionLayouts } from './sectionLayoutStore';

// ── Props ────────────────────────────────────────────────────────────────

export interface SectionGridContentProps {
  sectionId: string;
  layout: SectionLayout;
  rows: SequentialRow[];
  cohortData: CohortClassified[];
  finalCohortSizes?: Record<string, number | null>;
  spacers?: BarChartSpacer[];
  tteCohorts?: TimeToEventCohort[];
  table2Cohorts?: Table2Cohort[];
  onNavigateToRow?: (row: SequentialRow) => void;
  onRenameRow?: (name: string, displayName: string) => void;
}

/**
 * The grid section view: renders the section's rows as resizable, draggable
 * widgets arranged on a grid. Placement is read from / written back to the
 * active layout in the section layout store. Chart content is shared with the
 * list view via `SectionRowRenderer`.
 */
export const SectionGridContent = memo<SectionGridContentProps>(({
  sectionId,
  layout,
  rows,
  cohortData,
  finalCohortSizes,
  spacers,
  tteCohorts,
  table2Cohorts,
  onNavigateToRow,
  onRenameRow,
}) => {
  const { updateLayoutItems } = useSectionLayouts(sectionId);

  const rowByKey = useMemo(() => {
    const map = new Map<string, SequentialRow>();
    for (const row of rows) map.set(row.name, row);
    return map;
  }, [rows]);

  const gridItems = useMemo<SectionGridRenderItem[]>(
    () => rows.map((row) => ({
      key: row.name,
      title: sectionRowTitle(row),
      titleNode: (
        <SectionRowTitle row={row} onRename={onRenameRow} onOpen={onNavigateToRow} />
      ),
      content: (
        <SectionRowRenderer
          row={row}
          cohortData={cohortData}
          finalCohortSizes={finalCohortSizes}
          spacers={spacers}
          tteCohorts={tteCohorts}
          table2Cohorts={table2Cohorts}
          fillHeight={row.rowType === 'boolean' || row.rowType === 'numeric' || row.rowType === 'categorical'}
        />
      ),
    })),
    [rows, cohortData, finalCohortSizes, spacers, tteCohorts, table2Cohorts, onNavigateToRow, onRenameRow],
  );

  const handleLayoutChange = useCallback((items: GridItem[]) => {
    updateLayoutItems(layout.id, items);
  }, [updateLayoutItems, layout.id]);

  // Tiles are sized to fit the current cohorts (one bar/boxplot per cohort).
  // This only re-runs when the cohort count changes: every tile takes the new
  // height and is shifted by the height delta of the tiles above it, so shrunk
  // cohorts pull items up (and grown ones push down) by exactly that delta.
  // Between changes the stored layout is untouched, leaving manual moves free.
  useEffect(() => {
    const newH = defaultTileRows(cohortData.length);
    const oldH = layout.items[0]?.h;
    if (oldH === undefined || oldH === newH) return;
    updateLayoutItems(layout.id, restackForTileHeight(layout.items, oldH, newH));
  }, [cohortData.length, layout.id, layout.items, updateLayoutItems]);

  const handleItemClick = useCallback((key: string) => {
    const row = rowByKey.get(key);
    if (row) onNavigateToRow?.(row);
  }, [rowByKey, onNavigateToRow]);

  return (
    <SectionGrid
      items={gridItems}
      layout={layout.items}
      onLayoutChange={handleLayoutChange}
      onItemClick={handleItemClick}
    />
  );
});
