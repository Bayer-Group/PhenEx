import { type CohortClassified } from '../../types';

export const DEFAULT_TICKS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
export const COMPACT_GRID_LINES = [0, 25, 50, 75, 100];
export const HEADER_TICKS = [0, 25, 50, 75, 100];

export interface BarChartData {
  name: string;
  _meta: {
    cohortData: CohortClassified[];
    ticks?: number[];
    finalCohortSizes?: Record<string, number | null>;
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
}

export interface RenderRow {
  cohort: CohortClassified;
  originalIndex: number;
  label: string;
}

export interface RenderRowOptions {
  label?: string;
  labelClassName?: string;
  labelStyle?: React.CSSProperties;
}

export interface RenderGroup {
  name: string;
  displayName: string;
  color: string;
  mainRow: RenderRow | null;
  rows: RenderRow[];
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

export function withHundredTick(ticks: number[]): number[] {
  return ticks.includes(100) ? ticks : [...ticks, 100];
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

export function buildGroupedRows(cohortData: CohortClassified[]): RenderGroup[] {
  return cohortData.reduce<RenderGroup[]>((groups, cohort, index) => {
    const { parent, label } = splitCohortName(cohort.name);
    let group = groups.find((entry) => entry.name === parent);
    if (!group) {
      group = {
        name: parent,
        displayName: formatCohortLabel(parent),
        color: cohort.color,
        mainRow: null,
        rows: [],
      };
      groups.push(group);
    }
    const entry = {
      cohort,
      originalIndex: index,
      label: cohort.displayName || formatCohortLabel(label),
    };
    if (label === 'main') {
      group.mainRow = entry;
      if (cohort.displayName) group.displayName = cohort.displayName;
    } else {
      group.rows.push(entry);
    }
    return groups;
  }, []);
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
