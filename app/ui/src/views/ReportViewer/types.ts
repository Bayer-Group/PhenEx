export const COLORS = [
  '#2E5A88', '#B8533E', '#3A7D6E', '#7B5EA7', '#C4853A',
  '#5B8C3E', '#A04668', '#3E7FA8', '#8C6D3F', '#6B4C7A',
];

/** An active legend item: a selected cohort at a specific display index/color. */
export interface LegendSelection {
  /** Full cohort directory name (e.g. "cohort1_baseline__age_40_45") */
  cohortName: string;
  /** Index into COLORS */
  colorIndex: number;
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

export interface Table1Data {
  rows: Table1Row[];
  sections: Record<string, string[]>;
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
  /** Index into COLORS */
  ci: number;
  classified: ClassifiedRows;
  data: Table1Data;
}

export interface SectionGroup {
  section: string | null;
  items: string[];
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
