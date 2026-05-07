import { colorConfig } from './data/barchartcolors';

/** Build COHORT_BASE_COLORS from the config. */
const palette = colorConfig.palette as Record<string, readonly [number, number, number]>;
export const COHORT_BASE_COLORS: string[] = colorConfig.cohortColorOrder.map((name) => {
  const [r, g, b] = palette[name];
  return `rgb(${r}, ${g}, ${b})`;
});

/**
 * Get the color for a selection, based on its cohort group index and
 * subcohort position within that group. Subcohorts fade in alpha.
 */
export function getCohortColor(
  groupIndex: number,
  subIndex: number,
  totalSubs: number,
): string {
  const base = COHORT_BASE_COLORS[groupIndex % COHORT_BASE_COLORS.length];
  if (totalSubs <= 1) return base;
  const alpha = 1.0 - (subIndex / totalSubs) * 0.65;
  const m = base.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return base;
  return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`;
}

// Keep COLORS for backward compat
export const COLORS = COHORT_BASE_COLORS;

/** An active legend item: a selected cohort at a specific display index/color. */
export interface LegendSelection {
  /** Full cohort directory name (e.g. "cohort1_baseline__age_40_45") */
  cohortName: string;
  /** Index into COLORS */
  colorIndex: number;
  /** Index of the parent cohort group (for grouped coloring) */
  groupIndex: number;
  /** Index of subcohort within its group */
  subIndex: number;
  /** Total number of subcohorts in the group */
  totalSubs: number;
}

/** Parsed cohort group: a parent cohort with its subcohorts. */
export interface CohortGroup {
  /** Parent cohort name (no __) */
  parent: string;
  /** Subcohort entries: label + full directory name */
  subcohorts: { label: string; fullName: string }[];
}

/** Parse a flat list of cohort directory names into grouped structure. */
export function parseCohortGroups(names: string[]): CohortGroup[] {
  const groupMap = new Map<string, { label: string; fullName: string }[]>();
  const order: string[] = [];

  for (const name of names) {
    const idx = name.indexOf('__');
    if (idx === -1) {
      // Parent cohort
      if (!groupMap.has(name)) {
        groupMap.set(name, []);
        order.push(name);
      }
      // Auto-add "main" as the first subcohort
      groupMap.get(name)!.unshift({ label: 'main', fullName: name });
    } else {
      const parent = name.substring(0, idx);
      const sub = name.substring(idx + 2);
      if (!groupMap.has(parent)) {
        groupMap.set(parent, [{ label: 'main', fullName: parent }]);
        order.push(parent);
      }
      groupMap.get(parent)!.push({ label: sub, fullName: name });
    }
  }

  return order.map((parent) => ({
    parent,
    subcohorts: groupMap.get(parent)!,
  }));
}

export interface Table1Row {
  Name: string;
  N: number;
  Pct: number;
  _level?: number;
  Mean?: number | null;
  STD?: number | null;
  Min?: number | null;
  P10?: number | null;
  P25?: number | null;
  Median?: number | null;
  P75?: number | null;
  P90?: number | null;
  Max?: number | null;
}

export interface KdeCurve {
  x: number[];
  y: number[];
}

export interface Table1Data {
  rows: Table1Row[];
  sections: Record<string, string[]>;
  kdes?: Record<string, KdeCurve>;
}

export interface CohortEntry {
  cohortName: string;
  data: Table1Data;
}

export interface ClassifiedRows {
  booleans: Table1Row[];
  categoricals: Record<string, { category: string; N: number; Pct: number }[]>;
  catOrder: string[];
  numerics: Table1Row[];
}

export interface CohortClassified {
  name: string;
  /** Index into COLORS (legacy) */
  ci: number;
  /** Resolved color string for this cohort */
  color: string;
  classified: ClassifiedRows;
  data: Table1Data;
}

export interface SectionGroup {
  section: string | null;
  items: string[];
}

/* ── Unified characteristic types ──────────────────────────────────── */

export type CharacteristicType = 'boolean' | 'categorical' | 'numeric';

export interface CharacteristicItem {
  baseName: string;
  type: CharacteristicType;
}

export interface MixedSectionGroup {
  section: string | null;
  items: CharacteristicItem[];
}

/** Collect all unique characteristics across cohorts, preserving order. */
export function collectCharacteristics(cohortData: CohortClassified[]): CharacteristicItem[] {
  const seen = new Map<string, CharacteristicType>();
  const order: string[] = [];

  for (const cd of cohortData) {
    for (const row of cd.data.rows) {
      if (row.Name === 'Cohort') continue;
      if (row._level && row._level > 0) continue;

      const eqIdx = row.Name.indexOf('=');
      const baseName = eqIdx !== -1 ? row.Name.substring(0, eqIdx) : row.Name;

      if (!seen.has(baseName)) {
        let type: CharacteristicType;
        if (eqIdx !== -1) {
          type = 'categorical';
        } else if (row.Mean != null && !isNaN(row.Mean)) {
          type = 'numeric';
        } else {
          type = 'boolean';
        }
        seen.set(baseName, type);
        order.push(baseName);
      }
    }
  }

  return order.map((name) => ({ baseName: name, type: seen.get(name)! }));
}

/** Group mixed characteristics by section definitions. */
export function groupCharacteristicsBySection(
  items: CharacteristicItem[],
  sections: Record<string, string[]> | null,
): MixedSectionGroup[] {
  if (!sections) return [{ section: null, items }];

  const groups: MixedSectionGroup[] = [];
  const used = new Set<string>();

  for (const sec of Object.keys(sections)) {
    const chars = sections[sec];
    const matched: CharacteristicItem[] = [];
    for (const item of items) {
      if (chars.includes(item.baseName)) {
        matched.push(item);
        used.add(item.baseName);
      }
    }
    if (matched.length) groups.push({ section: sec, items: matched });
  }

  const ungrouped = items.filter((item) => !used.has(item.baseName));
  if (ungrouped.length) groups.push({ section: null, items: ungrouped });

  return groups;
}

/** Classify table1 rows into booleans, categoricals, and numerics. */
export function classifyRows(rows: Table1Row[]): ClassifiedRows {
  const booleans: Table1Row[] = [];
  const categoricals: Record<string, { category: string; N: number; Pct: number }[]> = {};
  const catOrder: string[] = [];
  const numerics: Table1Row[] = [];

  for (const row of rows) {
    if (row.Name === 'Cohort') continue;
    if (row._level && row._level > 0) continue;

    const eqIdx = row.Name.indexOf('=');
    if (eqIdx !== -1) {
      const pheno = row.Name.substring(0, eqIdx);
      const cat = row.Name.substring(eqIdx + 1);
      if (!categoricals[pheno]) {
        categoricals[pheno] = [];
        catOrder.push(pheno);
      }
      categoricals[pheno].push({ category: cat, N: row.N || 0, Pct: row.Pct || 0 });
    } else if (row.Mean != null && !isNaN(row.Mean)) {
      numerics.push(row);
    } else {
      booleans.push(row);
    }
  }

  return { booleans, categoricals, catOrder, numerics };
}

/** Group characteristic names by section definitions. */
export function groupBySection(
  names: string[],
  sections: Record<string, string[]> | null,
): SectionGroup[] {
  if (!sections) return [{ section: null, items: names }];

  const groups: SectionGroup[] = [];
  const used = new Set<string>();

  for (const sec of Object.keys(sections)) {
    const chars = sections[sec];
    const items: string[] = [];
    for (const name of names) {
      for (const ch of chars) {
        if (name === ch || name.startsWith(ch + '=')) {
          items.push(name);
          used.add(name);
          break;
        }
      }
    }
    if (items.length) groups.push({ section: sec, items });
  }

  const ungrouped = names.filter((n) => !used.has(n));
  if (ungrouped.length) groups.push({ section: null, items: ungrouped });

  return groups;
}
