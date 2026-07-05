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
  type?: string;
  date?: string;
  user?: string;
  status?: 'accepted' | 'resolved' | 'pinned' | string;
  text: string;
}

export interface RegistryRowEntry {
  name: string;
  display_name: string;
  description: string;
  comments: RegistryComment[];
}

export interface RegistryReporter {
  rows: RegistryRowEntry[];
}

export interface StudyRegistry {
  reporters: Record<string, RegistryReporter>;
  comments: RegistryComment[];
}

// ── Sequential row list types ───────────────────────────────────────────

export type RowType = CharacteristicType | 'waterfall' | 'table2' | 'time_to_event' | 'study_info';

export interface SequentialRow {
  /** Global 0-based index in the flat list */
  index: number;
  /** Top-level grouping: attrition | baseline_characteristics | outcomes */
  category: string;
  /** Reporter key matching the registry: waterfall, table1, table1_outcomes, Table2, TimeToEvent */
  reporter: string;
  /** Section within the reporter (e.g. "Demographics"), or null */
  section: string | null;
  /** Stable id of the editable outline section this row belongs to, if any. */
  sectionId?: string;
  /** Row name as it appears in the data */
  name: string;
  /** Editable display label; falls back to registry.display_name || name. */
  displayName?: string;
  /** What type of modal content to render */
  rowType: RowType;
  /** Registry metadata (if found) */
  registry: RegistryRowEntry | null;
}

// ── Grouping helpers ────────────────────────────────────────────────────

export interface SequentialSection {
  section: string | null;
  rows: SequentialRow[];
}

// ── Viewer entries (category / multi-row section / single row) ──────────

export type ViewerEntry =
  | { kind: 'row'; index: number; key: string; row: SequentialRow }
  | { kind: 'section'; index: number; key: string; section: string; sectionId?: string; rows: SequentialRow[]; reporter: string; category: string }
  | { kind: 'category'; index: number; key: string; category: string; reporter: string; sectionNames: string[]; hasSectionlessRows: boolean };

/** Distributive `Omit` so each union member keeps its own discriminated props. */
type ViewerEntryDraft = ViewerEntry extends infer T ? (T extends ViewerEntry ? Omit<T, 'index'> : never) : never;

// ── Category presentation ───────────────────────────────────────────────

export const STUDY_INFO_CATEGORY = 'study_info';

export const CATEGORY_LABELS: Record<string, string> = {
  attrition: 'Attrition',
  baseline_characteristics: 'Baseline characteristics',
  outcomes: 'Outcomes',
};

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  attrition: 'How the study population was derived — the sequence of inclusion and exclusion criteria applied and the number of patients remaining at each step.',
  baseline_characteristics: 'The following pages allow us to characterize all cohorts and subcohorts at study entry date. Features are grouped into the sections below. Click on a section to jump to it, or use the outline in the left panel to navigate. Use left and right arrows to skip to the next or previous item, with order defined by the outline',
  outcomes: 'Clinical endpoints observed during follow-up, including incidence rates and time-to-event analyses, grouped into the sections below.',
};

export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

// ── Stable entry keys (used to track identity across expand/collapse) ────

export function categoryKey(category: string): string {
  return `cat::${category}`;
}

export function sectionKey(category: string, section: string): string {
  return `sec::${category}::${section}`;
}

export function rowKey(row: SequentialRow): string {
  return `row::${row.index}`;
}

/**
 * Does the accordion `key` (a section or sectionless-category key) own `row`?
 * Used to find the parent cell to jump to when a section is collapsed.
 */
export function keyMatchesRow(key: string, row: SequentialRow): boolean {
  if (key.startsWith('sec::')) {
    const rest = key.slice('sec::'.length);
    const sep = rest.indexOf('::');
    if (sep === -1) return false;
    return row.category === rest.slice(0, sep) && row.section === rest.slice(sep + 2);
  }
  if (key.startsWith('cat::')) {
    return row.category === key.slice('cat::'.length) && row.section === null;
  }
  return false;
}

// ── Category → section grouping ─────────────────────────────────────────

interface CategoryGroup {
  category: string;
  reporter: string;
  sections: SequentialSection[];
}

/** Group sequential rows by category (then section), preserving order. */
function groupRowsByCategory(rows: SequentialRow[]): CategoryGroup[] {
  const groups: CategoryGroup[] = [];
  for (const row of rows) {
    let group = groups[groups.length - 1];
    if (!group || group.category !== row.category) {
      group = { category: row.category, reporter: row.reporter, sections: [] };
      groups.push(group);
    }
    let section = group.sections[group.sections.length - 1];
    if (!section || section.section !== row.section) {
      section = { section: row.section, rows: [] };
      group.sections.push(section);
    }
    section.rows.push(row);
  }
  return groups;
}

/**
 * Builds the navigable list of cells for the HorizontalRowViewer.
 *
 * The list is hierarchical and driven by the outline's accordion state:
 *  - every category renders a `category` cell (overview + its sections),
 *  - every named section renders a `section` (multi-row) cell,
 *  - individual `row` cells appear only for accordion keys present in
 *    `expandedKeys` (a named section, or a category that holds sectionless rows).
 *
 * With an empty `expandedKeys` the result contains no single-row cells, so the
 * scrollable items mirror exactly what the collapsed outline shows.
 */
export function buildAccordionEntries(
  sequentialRows: SequentialRow[],
  expandedKeys: Set<string>,
): ViewerEntry[] {
  const entries: ViewerEntry[] = [];
  const push = (entry: ViewerEntryDraft) => {
    entries.push({ ...entry, index: entries.length } as ViewerEntry);
  };

  for (const group of groupRowsByCategory(sequentialRows)) {
    // study_info is a standalone intro cell, not part of the accordion.
    if (group.category === STUDY_INFO_CATEGORY) {
      for (const section of group.sections) {
        for (const row of section.rows) push({ kind: 'row', key: rowKey(row), row });
      }
      continue;
    }

    const namedSections = group.sections.filter(
      (s): s is { section: string; rows: SequentialRow[] } => s.section !== null,
    );
    const sectionlessRows = group.sections
      .filter((s) => s.section === null)
      .flatMap((s) => s.rows);

    push({
      kind: 'category',
      key: categoryKey(group.category),
      category: group.category,
      reporter: group.reporter,
      sectionNames: namedSections.map((s) => s.section),
      hasSectionlessRows: sectionlessRows.length > 0,
    });

    for (const section of namedSections) {
      const key = sectionKey(group.category, section.section);
      push({
        kind: 'section',
        key,
        section: section.section,
        sectionId: section.rows[0].sectionId,
        rows: section.rows,
        reporter: section.rows[0].reporter,
        category: group.category,
      });
      // Sections expand into individual row cells when expanded.
      if (section.rows.length >= 1 && expandedKeys.has(key)) {
        for (const row of section.rows) push({ kind: 'row', key: rowKey(row), row });
      }
    }

    if (sectionlessRows.length > 0 && expandedKeys.has(categoryKey(group.category))) {
      for (const row of sectionlessRows) push({ kind: 'row', key: rowKey(row), row });
    }
  }

  return entries;
}

/**
 * Flat list of section + row entries (no category cells, no accordion).
 * Used by the spatial study display, where every row is always present and is
 * mapped 1:1 to a navigable target.
 */
export function buildViewerEntries(sequentialRows: SequentialRow[]): ViewerEntry[] {
  const entries: ViewerEntry[] = [];
  const push = (entry: ViewerEntryDraft) => {
    entries.push({ ...entry, index: entries.length } as ViewerEntry);
  };

  for (const { section, rows } of groupRowsBySection(sequentialRows)) {
    if (section && rows.length >= 2) {
      push({
        kind: 'section',
        key: sectionKey(rows[0].category, section),
        section,
        rows,
        reporter: rows[0].reporter,
        category: rows[0].category,
      });
    }
    for (const row of rows) {
      push({ kind: 'row', key: rowKey(row), row });
    }
  }

  return entries;
}

// ── ViewerEntry accessors ───────────────────────────────────────────────

/** Top-level category for an entry. */
export function getEntryCategory(entry: ViewerEntry): string {
  return entry.kind === 'row' ? entry.row.category : entry.category;
}

/** Section name for an entry, or null. */
export function getEntrySection(entry: ViewerEntry): string | null {
  if (entry.kind === 'row') return entry.row.section;
  if (entry.kind === 'section') return entry.section;
  return null;
}

/** Human-readable label for an entry (row display name, section, or category). */
export function getEntryLabel(entry: ViewerEntry): string {
  if (entry.kind === 'section') return entry.section;
  if (entry.kind === 'category') return getCategoryLabel(entry.category);
  return entry.row.displayName || entry.row.registry?.display_name || entry.row.name;
}

/** Group sequential rows by their `section` field, preserving order. */
export function groupRowsBySection(rows: SequentialRow[]): SequentialSection[] {
  const groups: SequentialSection[] = [];
  let current: SequentialSection | null = null;
  for (const row of rows) {
    if (!current || current.section !== row.section) {
      current = { section: row.section, rows: [] };
      groups.push(current);
    }
    current.rows.push(row);
  }
  return groups;
}

/** Filter sequential rows by reporter and return them grouped by section. */
export function getReporterSections(allRows: SequentialRow[], reporter: string): SequentialSection[] {
  return groupRowsBySection(allRows.filter((r) => r.reporter === reporter));
}

/** Extract unique section names from sequential rows for a given reporter. */
export function getSectionNames(allRows: SequentialRow[], reporter: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const row of allRows) {
    if (row.reporter === reporter && row.section && !seen.has(row.section)) {
      seen.add(row.section);
      names.push(row.section);
    }
  }
  return names;
}

// ── Category → reporter mapping ─────────────────────────────────────────

const CATEGORY_REPORTERS: { category: string; reporters: string[] }[] = [
  { category: 'attrition', reporters: ['waterfall'] },
  { category: 'baseline_characteristics', reporters: ['table1'] },
  { category: 'outcomes', reporters: ['table1_outcomes', 'Table2', 'TimeToEvent'] },
];

/** Reporters that should appear as named sections within their category. */
const REPORTER_SECTION_NAMES: Record<string, string> = {
  Table2: 'Incidence Rates',
  TimeToEvent: 'Time to Event',
};

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
      if (!entries.length) return { names: [], sections: null, rowTypes };
      const seen = new Set<string>();
      const unique: string[] = [];
      for (const entry of entries) {
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
          } else if (rowTypes.get(baseName) === 'boolean' && eqIdx === -1 && row.Mean != null && !isNaN(row.Mean)) {
            // Upgrade: a later cohort reveals this is actually numeric
            rowTypes.set(baseName, 'numeric');
          }
        }
      }
      // Merge sections across all cohorts
      const mergedSections: Record<string, string[]> = {};
      const sectionOrder: string[] = [];
      for (const entry of entries) {
        const s = entry.data.sections;
        if (!s) continue;
        for (const [sec, names] of Object.entries(s)) {
          if (!(sec in mergedSections)) {
            mergedSections[sec] = [];
            sectionOrder.push(sec);
          }
          const existing = new Set(mergedSections[sec]);
          for (const name of names) {
            if (!existing.has(name)) {
              mergedSections[sec].push(name);
              existing.add(name);
            }
          }
        }
      }
      const finalSections = sectionOrder.length > 0
        ? Object.fromEntries(sectionOrder.map((s) => [s, mergedSections[s]]))
        : null;
      return { names: unique, sections: finalSections, rowTypes };
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

  // Prepend a study_info row at position 0
  rows.push({
    index: index++,
    category: 'study_info',
    reporter: 'study_info',
    section: null,
    name: 'study_info',
    rowType: 'study_info',
    registry: null,
  });

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
        // No sections — flat list (use reporter section name if defined)
        const sectionName = REPORTER_SECTION_NAMES[reporter] ?? null;
        for (const name of names) {
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

  return rows;
}
