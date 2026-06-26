import { type CohortClassified } from '../../types';

export const DEFAULT_TICKS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
export const COMPACT_GRID_LINES = [0, 25, 50, 75, 100];
export const HEADER_TICKS = [0, 25, 50, 75, 100];

/** A spacer between cohort rows, positioned after a given cohort index. */
export interface BarChartSpacer {
  /** Index in cohortData after which the spacer appears (-1 = before first row). */
  afterIndex: number;
  /** Spacing magnitude (1-4). */
  size: number;
}

export interface BarChartData {
  name: string;
  _meta: {
    cohortData: CohortClassified[];
    ticks?: number[];
    finalCohortSizes?: Record<string, number | null>;
    /** Optional spacers interleaved between cohort rows, in display order. */
    spacers?: BarChartSpacer[];
  };
}

export interface BarChartBaseProps {
  data: BarChartData;
  /** When true, suppress click-to-open-modal (used inside BooleanRowModal). */
  isModal?: boolean;
  breadcrumbs?: string[];
  /** Number of decimal places for the % column (default 0). */
  pctDecimals?: number;
  /** Hide tick/%/N header when stacked directly under another compact bar chart. */
  hideHeader?: boolean;
  /**
   * Pixels per spacer unit. Spacer height = size * spacerUnitPx.
   * Defaults to a compact value; pass a larger value for presentation contexts.
   */
  spacerUnitPx?: number;
}

/** Base pixels per spacer "size" unit in compact contexts. */
export const SPACER_UNIT_PX = 6;

export interface RenderRow {
  cohort: CohortClassified;
  originalIndex: number;
  label: string;
}

export interface CohortRowValues {
  pct: number;
  n: number;
  finalCohortSize: number | null | undefined;
}

export function formatCohortLabel(value: string): string {
  const spaced = value.replace(/_/g, ' ').trim();
  if (!spaced) return value;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function splitCohortName(name: string): { parent: string; label: string } {
  const idx = name.indexOf('__');
  if (idx === -1) return { parent: name, label: 'main' };
  return {
    parent: name.substring(0, idx),
    label: name.substring(idx + 2),
  };
}

/** An item in an interleaved flat render list: a cohort row or a spacer. */
export type FlatRenderItem =
  | { type: 'row'; row: RenderRow }
  | { type: 'spacer'; size: number; key: string };

/**
 * Build a flat, ordered list of cohort rows interleaved with spacers.
 * Spacers are positioned by their `afterIndex` relative to cohortData order.
 */
export function buildFlatItems(
  cohortData: CohortClassified[],
  spacers: BarChartSpacer[] = [],
): FlatRenderItem[] {
  const rows = buildFlatRows(cohortData);
  const items: FlatRenderItem[] = [];

  const emitSpacersAfter = (index: number) => {
    spacers.forEach((s, i) => {
      if (s.afterIndex === index) {
        items.push({ type: 'spacer', size: s.size, key: `spacer-${index}-${i}` });
      }
    });
  };

  emitSpacersAfter(-1);
  rows.forEach((row, index) => {
    items.push({ type: 'row', row });
    emitSpacersAfter(index);
  });

  return items;
}

export function buildFlatRows(cohortData: CohortClassified[]): RenderRow[] {
  return cohortData.map((cohort, index) => {
    const { label } = splitCohortName(cohort.name);
    return {
      cohort,
      originalIndex: index,
      label: cohort.displayName || formatCohortLabel(label),
    };
  });
}

export function getCohortRowValues(
  entry: RenderRow,
  rowName: string,
  finalCohortSizes: Record<string, number | null>,
): CohortRowValues {
  const row = entry.cohort.data.rows.find((r) => r.Name === rowName);
  const rawPct = row?.Pct;
  const pct = (rawPct != null && Number.isFinite(rawPct)) ? rawPct : 0;
  const n = row?.N ?? 0;
  const finalCohortSize = finalCohortSizes[entry.cohort.name];
  return { pct, n, finalCohortSize };
}
