/**
 * Builds a sequential list of all report rows merged with the study registry,
 * grouped by category → reporter → section → row.
 *
 * This produces a flat array where each entry carries enough context
 * (category, reporter, section, registry metadata) to navigate prev/next
 * through modals.
 */

import type { CohortEntry, Table2Row, TimeToEventRow, CharacteristicType } from './types';

// ── Study registry types ────────────────────────────────────────────────

export interface RegistryComment {
  date: string;
  user: string;
  status: 'accepted' | 'resolved' | 'pinned' | string;
  text: string;
}

export interface RegistryRowEntry {
  name: string;
  display_name: string;
  description: string;
  comments: number[];
}

export interface RegistryReporter {
  rows: RegistryRowEntry[];
}

export interface StudyRegistry {
  reporters: Record<string, RegistryReporter>;
  comments: RegistryComment[];
}

// ── Sequential row list types ───────────────────────────────────────────

export type RowType = CharacteristicType | 'waterfall' | 'table2' | 'time_to_event';

export interface SequentialRow {
  /** Global 0-based index in the flat list */
  index: number;
  /** Top-level grouping: attrition | baseline_characteristics | outcomes */
  category: string;
  /** Reporter key matching the registry: waterfall, table1, table1_outcomes, Table2, TimeToEvent */
  reporter: string;
  /** Section within the reporter (e.g. "Demographics"), or null */
  section: string | null;
  /** Row name as it appears in the data */
  name: string;
  /** What type of modal content to render */
  rowType: RowType;
  /** Registry metadata (if found) */
  registry: RegistryRowEntry | null;
}

// ── Category → reporter mapping ─────────────────────────────────────────

const CATEGORY_REPORTERS: { category: string; reporters: string[] }[] = [
  { category: 'attrition', reporters: ['waterfall'] },
  { category: 'baseline_characteristics', reporters: ['table1'] },
  { category: 'outcomes', reporters: ['table1_outcomes', 'Table2', 'TimeToEvent'] },
];

// ── Row name keys per reporter type ─────────────────────────────────────

function extractRowNames(
  reporter: string,
  table1Data: CohortEntry[],
  outcomesData: CohortEntry[],
  waterfallData: Record<string, unknown>,
  table2Data?: Record<string, Table2Row[]>,
  timeToEventData?: Record<string, TimeToEventRow[]>,
): { names: string[]; sections: Record<string, string[]> | null; rowTypes: Map<string, RowType> } {
  const rowTypes = new Map<string, RowType>();

  switch (reporter) {
    case 'table1':
    case 'table1_outcomes': {
      const entries = reporter === 'table1' ? table1Data : outcomesData;
      const entry = entries[0];
      if (!entry) return { names: [], sections: null, rowTypes };
      const seen = new Set<string>();
      const unique: string[] = [];
      for (const row of entry.data.rows) {
        if (row.Name === 'Cohort') continue;
        if (row._level && row._level > 0) continue;
        const eqIdx = row.Name.indexOf('=');
        const baseName = eqIdx !== -1 ? row.Name.substring(0, eqIdx) : row.Name;
        if (!seen.has(baseName)) {
          seen.add(baseName);
          unique.push(baseName);
          if (eqIdx !== -1) {
            rowTypes.set(baseName, 'categorical');
          } else if (row.Mean != null && !isNaN(row.Mean)) {
            rowTypes.set(baseName, 'numeric');
          } else {
            rowTypes.set(baseName, 'boolean');
          }
        }
      }
      return { names: unique, sections: entry.data.sections, rowTypes };
    }
    case 'waterfall': {
      const firstKey = Object.keys(waterfallData)[0];
      if (!firstKey) return { names: [], sections: null, rowTypes };
      const rows = waterfallData[firstKey];
      if (!Array.isArray(rows)) return { names: [], sections: null, rowTypes };
      const names = (rows as { Name: string }[]).map((r) => r.Name);
      for (const n of names) rowTypes.set(n, 'waterfall');
      return { names, sections: null, rowTypes };
    }
    case 'Table2': {
      if (!table2Data) return { names: [], sections: null, rowTypes };
      const firstKey = Object.keys(table2Data)[0];
      if (!firstKey) return { names: [], sections: null, rowTypes };
      const seen = new Set<string>();
      const names: string[] = [];
      for (const row of table2Data[firstKey]) {
        if (!seen.has(row.Outcome)) {
          seen.add(row.Outcome);
          names.push(row.Outcome);
          rowTypes.set(row.Outcome, 'table2');
        }
      }
      return { names, sections: null, rowTypes };
    }
    case 'TimeToEvent': {
      if (!timeToEventData) return { names: [], sections: null, rowTypes };
      const firstKey = Object.keys(timeToEventData)[0];
      if (!firstKey) return { names: [], sections: null, rowTypes };
      const seen = new Set<string>();
      const names: string[] = [];
      for (const row of timeToEventData[firstKey]) {
        if (!seen.has(row.Outcome)) {
          seen.add(row.Outcome);
          names.push(row.Outcome);
          rowTypes.set(row.Outcome, 'time_to_event');
        }
      }
      return { names, sections: null, rowTypes };
    }
    default:
      return { names: [], sections: null, rowTypes };
  }
}

// ── Build the sequential list ───────────────────────────────────────────

export function buildSequentialRowList(
  registry: StudyRegistry | null,
  table1Data: CohortEntry[],
  outcomesData: CohortEntry[],
  waterfallData: Record<string, unknown>,
  table2Data?: Record<string, Table2Row[]>,
  timeToEventData?: Record<string, TimeToEventRow[]>,
): SequentialRow[] {
  const rows: SequentialRow[] = [];
  let index = 0;

  // Build a lookup from registry: reporter → name → entry
  const registryLookup = new Map<string, Map<string, RegistryRowEntry>>();
  if (registry?.reporters) {
    for (const [reporterKey, reporterData] of Object.entries(registry.reporters)) {
      const nameMap = new Map<string, RegistryRowEntry>();
      for (const row of reporterData.rows) {
        nameMap.set(row.name, row);
      }
      registryLookup.set(reporterKey, nameMap);
    }
  }

  for (const { category, reporters } of CATEGORY_REPORTERS) {
    for (const reporter of reporters) {
      const { names, sections, rowTypes } = extractRowNames(
        reporter,
        table1Data,
        outcomesData,
        waterfallData,
        table2Data,
        timeToEventData,
      );

      if (names.length === 0) continue;

      const reporterRegistry = registryLookup.get(reporter);

      if (sections && Object.keys(sections).length > 0) {
        // Section-aware ordering: emit rows grouped by section
        const used = new Set<string>();
        for (const [sectionName, sectionRowNames] of Object.entries(sections)) {
          const sectionSet = new Set(sectionRowNames);
          for (const name of names) {
            // Match: exact name, or base name before "=" for categoricals
            const baseName = name.includes('=') ? name.substring(0, name.indexOf('=')) : name;
            if (sectionSet.has(name) || sectionSet.has(baseName)) {
              if (!used.has(name)) {
                used.add(name);
                rows.push({
                  index: index++,
                  category,
                  reporter,
                  section: sectionName,
                  name,
                  rowType: rowTypes.get(name) ?? 'boolean',
                  registry: reporterRegistry?.get(name) ?? null,
                });
              }
            }
          }
        }
        // Any remaining rows not in a section
        for (const name of names) {
          if (!used.has(name)) {
            rows.push({
              index: index++,
              category,
              reporter,
              section: null,
              name,
              rowType: rowTypes.get(name) ?? 'boolean',
              registry: reporterRegistry?.get(name) ?? null,
            });
          }
        }
      } else {
        // No sections — flat list
        for (const name of names) {
          rows.push({
            index: index++,
            category,
            reporter,
            section: null,
            name,
            rowType: rowTypes.get(name) ?? 'boolean',
            registry: reporterRegistry?.get(name) ?? null,
          });
        }
      }
    }
  }

  return rows;
}
