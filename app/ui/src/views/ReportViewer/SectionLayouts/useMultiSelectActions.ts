import { useCallback, useEffect, useMemo } from 'react';
import type { SequentialRow } from '../studyRegistryUtils';
import type { GridSelection } from './GridSelection';
import {
  type CellGroup,
  type GridItem,
  GRID_COLUMNS,
  TILE_HEADER_ROWS,
  defaultTileRows,
} from './sectionLayoutStore';
import { hasVariants, nextVariant } from './rowVariants';

// ── Params / result ──────────────────────────────────────────────────────

export interface UseMultiSelectActionsParams {
  selection: GridSelection;
  /** Resolve a top-level item key to its row (undefined for group keys). */
  rowByKey: Map<string, SequentialRow>;
  groups: CellGroup[];
  /** The active layout's stored placements (for the reset-size action). */
  layoutItems: GridItem[];
  displayVariants: Record<string, string>;
  /** Cohort count, used to size fresh/reset tiles. */
  cohortCount: number;
  editable: boolean;
  createGroup: (memberKeys: string[], height: number) => void;
  ungroup: (groupId: string) => void;
  setDisplayVariant: (rowKey: string, variantId: string) => void;
  toggleItemVisibility: (key: string) => void;
  setLayoutItems: (items: GridItem[]) => void;
}

export interface MultiSelectActions {
  count: number;
  canGroup: boolean;
  canUngroup: boolean;
  canChangeType: boolean;
  onGroup: () => void;
  onReset: () => void;
  onChangeType: () => void;
  onHide: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Grid-row height of a group tile hosting `memberCount` stacked members. */
function groupRows(memberCount: number, cohortCount: number): number {
  return TILE_HEADER_ROWS + Math.max(1, memberCount) * defaultTileRows(cohortCount);
}

/** True when focus sits in a control that owns character keys itself. */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

// ── Hook ─────────────────────────────────────────────────────────────────

/**
 * The behaviour behind the multiselect toolbar. Owns the semantics of each
 * action and binds them to keyboard shortcuts (g / t / r / h) while a selection
 * is active. Selection membership, group definitions and display variants all
 * live in their own stores; this hook only orchestrates them so both the
 * toolbar and the keyboard drive one implementation.
 */
export function useMultiSelectActions({
  selection,
  rowByKey,
  groups,
  layoutItems,
  displayVariants,
  cohortCount,
  editable,
  createGroup,
  ungroup,
  setDisplayVariant,
  toggleItemVisibility,
  setLayoutItems,
}: UseMultiSelectActionsParams): MultiSelectActions {
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  // Split the current selection into loose rows and group cells.
  const { selectedRows, selectedGroups, selectedKeys } = useMemo(() => {
    const keys = [...selection.selected];
    const rows: SequentialRow[] = [];
    const grps: CellGroup[] = [];
    for (const key of keys) {
      const grp = groupById.get(key);
      if (grp) grps.push(grp);
      else {
        const row = rowByKey.get(key);
        if (row) rows.push(row);
      }
    }
    return { selectedRows: rows, selectedGroups: grps, selectedKeys: keys };
  }, [selection.selected, groupById, rowByKey]);

  const canUngroup = selectedGroups.length > 0;
  const canGroup =
    selectedGroups.length === 0 &&
    selectedRows.length >= 2 &&
    selectedRows.length === selectedKeys.length &&
    selectedRows.every((r) => r.rowType === selectedRows[0].rowType);
  const canChangeType = selectedRows.some((r) => hasVariants(r.rowType));

  // ── Actions ──────────────────────────────────────────────────────────

  const onGroup = useCallback(() => {
    if (canUngroup) {
      selectedGroups.forEach((g) => ungroup(g.id));
    } else if (canGroup) {
      const members = selectedRows.map((r) => r.name);
      createGroup(members, groupRows(members.length, cohortCount));
    }
    selection.clear();
  }, [canUngroup, canGroup, selectedGroups, selectedRows, cohortCount, createGroup, ungroup, selection]);

  const onChangeType = useCallback(() => {
    selectedRows.forEach((row) => {
      if (hasVariants(row.rowType)) {
        setDisplayVariant(row.name, nextVariant(row.rowType, displayVariants[row.name]));
      }
    });
  }, [selectedRows, displayVariants, setDisplayVariant]);

  const onReset = useCallback(() => {
    const selected = selection.selected;
    const next = layoutItems.map((it) => {
      if (!selected.has(it.key)) return it;
      const grp = groupById.get(it.key);
      return grp
        ? { ...it, w: GRID_COLUMNS, h: groupRows(grp.memberKeys.length, cohortCount) }
        : { ...it, w: Math.min(2, GRID_COLUMNS), h: defaultTileRows(cohortCount) };
    });
    setLayoutItems(next);
  }, [selection.selected, layoutItems, groupById, cohortCount, setLayoutItems]);

  const onHide = useCallback(() => {
    // Dissolve any selected groups and hide their members, then hide loose rows.
    selectedGroups.forEach((g) => {
      g.memberKeys.forEach((key) => toggleItemVisibility(key));
      ungroup(g.id);
    });
    selectedRows.forEach((row) => toggleItemVisibility(row.name));
    selection.clear();
  }, [selectedGroups, selectedRows, toggleItemVisibility, ungroup, selection]);

  const onSelectAll = selection.selectAll;
  const onDeselectAll = selection.clear;

  // ── Keyboard shortcuts (g / t / r / h) ─────────────────────────────────

  useEffect(() => {
    if (!editable || selection.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      switch (e.key.toLowerCase()) {
        case 'g': e.preventDefault(); onGroup(); break;
        case 't': e.preventDefault(); onChangeType(); break;
        case 'r': e.preventDefault(); onReset(); break;
        case 'h': e.preventDefault(); onHide(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editable, selection.size, onGroup, onChangeType, onReset, onHide]);

  return {
    count: selection.size,
    canGroup,
    canUngroup,
    canChangeType,
    onGroup,
    onReset,
    onChangeType,
    onHide,
    onSelectAll,
    onDeselectAll,
  };
}
