import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { type CohortClassified } from '../types';
import { type BarChartSpacer, SPACER_UNIT_PX } from '../GraphsAndTables/RowRenderers/barChartShared';
import { type SequentialRow } from '../studyRegistryUtils';
import { type TimeToEventCohort, type Table2Cohort } from '../GraphsAndTables/OutcomesChart';
import { SectionRowRenderer, SectionRowTitle, sectionRowTitle } from './SectionRowRenderer';
import { type SectionGridRenderItem } from './SectionGrid';
import { ZoomableSectionGrid } from './ZoomableSectionGrid';
import { GroupCard } from './GroupCard';
import { MultiSelectControls } from './MultiSelectControls';
import { useGridSelection } from './GridSelection';
import { useMultiSelectActions } from './useMultiSelectActions';
import { restackByHeights } from './restackLayout';
import { type SectionLayout, type GridItem, defaultTileRows, contentTileRows, TILE_HEADER_ROWS, GRID_COLUMNS, GRID_GAP, useSectionLayouts, lockedChartHeight, isDefaultLayoutId } from './sectionLayoutStore';

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
  /** Measured card width (px), used to recompute tile heights on cohort change. */
  contentWidth?: number;
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
  contentWidth = 0,
}) => {
  const {
    updateLayoutItems,
    createDraftLayout,
    groups,
    displayVariants,
    descriptions,
    setDescription,
    createGroup,
    ungroup,
    setDisplayVariant,
    toggleItemVisibility,
  } = useSectionLayouts(sectionId);

  // Every layout is directly editable (free canvas). Editing a synthetic
  // default forks a draft (see `commitItems`), so there is no lock/unlock step.
  const editable = true;
  const isDefault = isDefaultLayoutId(layout.id);

  const rowByKey = useMemo(() => {
    const map = new Map<string, SequentialRow>();
    for (const row of rows) map.set(row.name, row);
    return map;
  }, [rows]);

  // Rows bundled into a group are rendered inside the group card, never loose.
  const groupedKeys = useMemo(() => new Set(groups.flatMap((g) => g.memberKeys)), [groups]);
  const looseRows = useMemo(() => rows.filter((r) => !groupedKeys.has(r.name)), [rows, groupedKeys]);

  // Total px height of all bar-chart spacers (cohort group separators), shared across rows.
  const spacersPx = useMemo(
    () => (spacers ?? []).reduce((sum, s) => sum + 10 + (s.size - 1) * SPACER_UNIT_PX, 0),
    [spacers],
  );

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
          autoHeight={row.rowType === 'categorical'}
        />
      ),
      // Categorical self-sizes (bar area fixed in its own CSS); others get a computed fixed height.
      chartHeightPx: row.rowType === 'categorical' ? undefined : lockedChartHeight(row.rowType, cohortData.length, spacersPx),
      description: descriptions[row.name] ?? '',
      onDescriptionChange: (value: string) => setDescription(row.name, value),
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
  }, [looseRows, groups, rowByKey, cohortData, finalCohortSizes, spacers, spacersPx, tteCohorts, table2Cohorts, displayVariants, descriptions, setDescription, onNavigateToRow, onRenameRow]);

  const itemKeys = useMemo(() => gridItems.map((it) => it.key), [gridItems]);
  const containerRef = useRef<HTMLDivElement>(null);
  const selection = useGridSelection(itemKeys, true, containerRef);

  // A geometry edit on a synthetic default forks it into an editable draft;
  // edits to a real (saved/draft) layout write straight through.
  const commitItems = useCallback((items: GridItem[]) => {
    if (isDefault) createDraftLayout(layout.columnsPerRow ?? 3, items);
    else updateLayoutItems(layout.id, items);
  }, [isDefault, createDraftLayout, updateLayoutItems, layout.id, layout.columnsPerRow]);

  // Structural edits (group/hide) need a real layout id: fork first if needed.
  const ensureDraft = useCallback(() => {
    if (isDefault) createDraftLayout(layout.columnsPerRow ?? 3, layout.items);
  }, [isDefault, createDraftLayout, layout.columnsPerRow, layout.items]);

  const createGroupForked = useCallback((memberKeys: string[], height: number) => {
    ensureDraft();
    return createGroup(memberKeys, height);
  }, [ensureDraft, createGroup]);

  const toggleItemVisibilityForked = useCallback((key: string) => {
    ensureDraft();
    toggleItemVisibility(key);
  }, [ensureDraft, toggleItemVisibility]);

  const actions = useMultiSelectActions({
    selection,
    rowByKey,
    groups,
    layoutItems: layout.items,
    displayVariants,
    cohortCount: cohortData.length,
    columnsPerRow: layout.columnsPerRow,
    editable,
    containerRef,
    createGroup: createGroupForked,
    ungroup,
    setDisplayVariant,
    toggleItemVisibility: toggleItemVisibilityForked,
    setLayoutItems: commitItems,
  });

  const handleLayoutChange = commitItems;

  // On a cohort-count change, resize every tile to its content height for the
  // new count (chart grows/shrinks with cohorts; title/description unchanged),
  // preserving the free arrangement via a per-tile restack. Synthetic defaults
  // are rebuilt from the current count on render, so they need no restack here.
  const prevCohortCountRef = useRef(cohortData.length);
  useEffect(() => {
    const prev = prevCohortCountRef.current;
    const next = cohortData.length;
    if (prev === next) return;
    prevCohortCountRef.current = next;
    if (isDefault) return;
    const nCols = layout.columnsPerRow ?? 3;
    const tileWidthPx = contentWidth > 0
      ? (contentWidth - GRID_GAP * (nCols - 1)) * (Math.floor(GRID_COLUMNS / nCols) / GRID_COLUMNS)
      : 0;
    const heights = new Map<string, number>();
    for (const row of rows) {
      heights.set(row.name, contentTileRows(row.rowType, next, sectionRowTitle(row), tileWidthPx, spacersPx));
    }
    for (const g of groups) {
      heights.set(g.id, TILE_HEADER_ROWS + Math.max(1, g.memberKeys.length) * defaultTileRows(next));
    }
    updateLayoutItems(layout.id, restackByHeights(layout.items, heights));
  }, [cohortData.length, isDefault, layout.id, layout.items, layout.columnsPerRow, rows, groups, spacersPx, contentWidth, updateLayoutItems]);

  const handleItemClick = useCallback((key: string) => {
    const row = rowByKey.get(key);
    if (row) onNavigateToRow?.(row);
  }, [rowByKey, onNavigateToRow]);

  return (
    <>
      <div ref={containerRef}>
        <ZoomableSectionGrid
          storageKey={`phenex.sectionZoom.${sectionId}.${layout.id}`}
          measureKey={layout.items}
          items={gridItems}
          layout={layout.items}
          selection={selection}
          editable={editable}
          columnsPerRow={layout.columnsPerRow}
          autoStack={isDefault}
          onLayoutChange={handleLayoutChange}
          onItemClick={handleItemClick}
        />
      </div>
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
