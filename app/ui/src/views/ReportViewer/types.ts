export const COLORS = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab',
];

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
