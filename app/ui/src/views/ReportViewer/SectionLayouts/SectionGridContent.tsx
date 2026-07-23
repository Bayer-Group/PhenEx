import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { type CohortClassified } from '../types';
import { type BarChartSpacer } from '../GraphsAndTables/RowRenderers/barChartShared';
import { type SequentialRow } from '../studyRegistryUtils';
import { type TimeToEventCohort, type Table2Cohort } from '../GraphsAndTables/OutcomesChart';
import { SectionRowRenderer, SectionRowTitle, sectionRowTitle } from './SectionRowRenderer';
import { SectionGrid, type SectionGridRenderItem } from './SectionGrid';
import { GroupCard } from './GroupCard';
import { MultiSelectControls } from './MultiSelectControls';
import { useGridSelection } from './GridSelection';
import { useMultiSelectActions } from './useMultiSelectActions';
import { restackByCohortDelta } from './CleanupGridLayout';
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
  const {
    updateLayoutItems,
    groups,
    displayVariants,
    createGroup,
    ungroup,
    setDisplayVariant,
    toggleItemVisibility,
  } = useSectionLayouts(sectionId);

  const rowByKey = useMemo(() => {
    const map = new Map<string, SequentialRow>();
    for (const row of rows) map.set(row.name, row);
    return map;
  }, [rows]);

  // Rows bundled into a group are rendered inside the group card, never loose.
  const groupedKeys = useMemo(() => new Set(groups.flatMap((g) => g.memberKeys)), [groups]);
  const looseRows = useMemo(() => rows.filter((r) => !groupedKeys.has(r.name)), [rows, groupedKeys]);

  const gridItems = useMemo<SectionGridRenderItem[]>(() => {
    const rowItems: SectionGridRenderItem[] = looseRows.map((row) => ({
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
          variant={displayVariants[row.name]}
          fillHeight={row.rowType === 'boolean' || row.rowType === 'numeric' || row.rowType === 'categorical'}
        />
      ),
    }));

    const groupItems: SectionGridRenderItem[] = groups.map((group) => {
      const members = group.memberKeys
        .map((key) => rowByKey.get(key))
        .filter((r): r is SequentialRow => r != null);
      return {
        key: group.id,
        title: `Group (${members.length})`,
        content: (
          <GroupCard
            members={members}
            cohortData={cohortData}
            finalCohortSizes={finalCohortSizes}
            spacers={spacers}
            tteCohorts={tteCohorts}
            table2Cohorts={table2Cohorts}
            displayVariants={displayVariants}
          />
        ),
      };
    });

    return [...rowItems, ...groupItems];
  }, [looseRows, groups, rowByKey, cohortData, finalCohortSizes, spacers, tteCohorts, table2Cohorts, displayVariants, onNavigateToRow, onRenameRow]);

  const itemKeys = useMemo(() => gridItems.map((it) => it.key), [gridItems]);
  const selection = useGridSelection(itemKeys, true);

  const setLayoutItems = useCallback((items: GridItem[]) => {
    updateLayoutItems(layout.id, items);
  }, [updateLayoutItems, layout.id]);

  const actions = useMultiSelectActions({
    selection,
    rowByKey,
    groups,
    layoutItems: layout.items,
    displayVariants,
    cohortCount: cohortData.length,
    editable: true,
    createGroup,
    ungroup,
    setDisplayVariant,
    toggleItemVisibility,
    setLayoutItems,
  });

  const handleLayoutChange = useCallback((items: GridItem[]) => {
    updateLayoutItems(layout.id, items);
  }, [updateLayoutItems, layout.id]);

  // Tiles react only to a *change* in the cohort count. On such a change every
  // tile keeps its own (possibly manually resized) height and is grown/shrunk
  // by the per-cohort row delta, so each cell holds its vertical scale relative
  // to the 1-cohort baseline. Between changes the stored layout is untouched,
  // leaving manual moves and resizes free.
  const prevCohortCountRef = useRef(cohortData.length);
  useEffect(() => {
    const prev = prevCohortCountRef.current;
    const next = cohortData.length;
    if (prev === next) return;
    prevCohortCountRef.current = next;
    const deltaRows = defaultTileRows(next) - defaultTileRows(prev);
    if (deltaRows === 0) return;
    updateLayoutItems(layout.id, restackByCohortDelta(layout.items, deltaRows));
  }, [cohortData.length, layout.id, layout.items, updateLayoutItems]);

  const handleItemClick = useCallback((key: string) => {
    const row = rowByKey.get(key);
    if (row) onNavigateToRow?.(row);
  }, [rowByKey, onNavigateToRow]);

  return (
    <>
      <SectionGrid
        items={gridItems}
        layout={layout.items}
        selection={selection}
        onLayoutChange={handleLayoutChange}
        onItemClick={handleItemClick}
      />
      <MultiSelectControls
        count={actions.count}
        canGroup={actions.canGroup}
        canUngroup={actions.canUngroup}
        canChangeType={actions.canChangeType}
        onGroup={actions.onGroup}
        onReset={actions.onReset}
        onChangeType={actions.onChangeType}
        onHide={actions.onHide}
        onSelectAll={actions.onSelectAll}
        onDeselectAll={actions.onDeselectAll}
      />
    </>
  );
});
