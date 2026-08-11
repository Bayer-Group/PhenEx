/**
 * Editable outline model.
 *
 * The report's baseline-characteristics phenotypes are originally grouped by
 * the `sections` dictionary that ships with the merged table1 data. This module
 * turns that read-only grouping into an editable, in-memory model that the user
 * can reorganize: phenotypes can be dragged between sections, and both sections
 * and phenotypes carry an editable `displayName`.
 *
 * The model is the single source of truth for the outline *and* the horizontal
 * viewer: {@link applyOutlineModel} rewrites the sequential-row list so that the
 * table1 block reflects the model's section order, membership and labels.
 */

import type { SequentialRow } from '../../studyRegistryUtils';

/** Only baseline-characteristics table1 rows are editable phenotypes. */
export const OUTLINE_CATEGORY = 'baseline_characteristics';
export const OUTLINE_REPORTER = 'table1';

/** Outcomes table1_outcomes rows also participate in the editable outline. */
export const OUTCOMES_CATEGORY = 'outcomes';
export const OUTCOMES_REPORTER = 'table1_outcomes';

/** Fallback label for phenotypes that have no section in the source data. */
export const UNGROUPED_SECTION = 'Other';

export interface OutlineSection {
  /** Stable identity, independent of the (renamable) display label. */
  id: string;
  /** Editable label shown in the outline and viewer. */
  displayName: string;
  /** Ordered phenotype identities (SequentialRow.name) in this section. */
  itemNames: string[];
}

export interface OutlineModel {
  sections: OutlineSection[];
  /** Phenotype identity (name) → editable display label. */
  phenotypeNames: Record<string, string>;
}

/** True for baseline-characteristics rows that participate in the editable outline. */
export function isOutlineRow(row: SequentialRow): boolean {
  return row.category === OUTLINE_CATEGORY && row.reporter === OUTLINE_REPORTER;
}

/** True for outcomes rows that participate in the editable outline. */
export function isOutcomesRow(row: SequentialRow): boolean {
  return row.category === OUTCOMES_CATEGORY && row.reporter === OUTCOMES_REPORTER;
}

/**
 * Stable, deterministic section identity derived from the section label.
 *
 * Using a deterministic id (instead of a random UUID) is essential: the outline
 * model is re-derived whenever the underlying cohort data changes (e.g. a cohort
 * is added), and a fresh random id each time would orphan anything keyed by the
 * section id — such as saved grid layouts. The id is fixed at creation time, so
 * later renames (which only change `displayName`) keep it stable.
 */
function sectionIdForLabel(label: string, prefix = 'osec'): string {
  return `${prefix}:${label}`;
}

/**
 * Build the initial editable model from the source sequential rows, mirroring
 * the table1 `sections` grouping (sectionless phenotypes fall into "Other").
 */
export function deriveOutlineModel(
  baseRows: SequentialRow[],
  rowPredicate: (r: SequentialRow) => boolean = isOutlineRow,
  idPrefix = 'osec',
): OutlineModel {
  const sections: OutlineSection[] = [];
  const byLabel = new Map<string, OutlineSection>();

  for (const row of baseRows) {
    if (!rowPredicate(row)) continue;
    const label = row.section ?? UNGROUPED_SECTION;
    let section = byLabel.get(label);
    if (!section) {
      section = { id: sectionIdForLabel(label, idPrefix), displayName: label, itemNames: [] };
      byLabel.set(label, section);
      sections.push(section);
    }
    section.itemNames.push(row.name);
  }

  return { sections, phenotypeNames: {} };
}

function sectionSignature(sections: OutlineSection[]): string {
  return sections.map((s) => `${s.id}|${s.displayName}|${s.itemNames.join(',')}`).join('||');
}

/**
 * Keep a stored model consistent with the currently available phenotypes:
 * drop phenotypes that no longer exist and file newly appeared ones into their
 * source section (creating it if needed). Returns the same reference when
 * nothing changed so React can skip re-renders.
 */
export function reconcileOutlineModel(
  model: OutlineModel,
  baseRows: SequentialRow[],
  rowPredicate: (r: SequentialRow) => boolean = isOutlineRow,
  idPrefix = 'osec',
): OutlineModel {
  const currentNames: string[] = [];
  const baseSectionByName = new Map<string, string>();
  for (const row of baseRows) {
    if (!rowPredicate(row)) continue;
    currentNames.push(row.name);
    baseSectionByName.set(row.name, row.section ?? UNGROUPED_SECTION);
  }
  const currentSet = new Set(currentNames);

  const placed = new Set<string>();
  // Keep user-added empty sections (no itemNames check filters them out prematurely)
  const sections: OutlineSection[] = model.sections.map((section) => {
    const itemNames = section.itemNames.filter((name) => currentSet.has(name));
    itemNames.forEach((name) => placed.add(name));
    return itemNames.length === section.itemNames.length ? section : { ...section, itemNames };
  });

  for (const name of currentNames) {
    if (placed.has(name)) continue;
    const label = baseSectionByName.get(name) ?? UNGROUPED_SECTION;
    let section = sections.find((s) => s.displayName === label);
    if (!section) {
      section = { id: sectionIdForLabel(label, idPrefix), displayName: label, itemNames: [] };
      sections.push(section);
    }
    section.itemNames.push(name);
  }

  // Preserve all sections that were in the stored model — empty sections are kept
  // until explicitly deleted. Only drop sections that were never in the model.
  if (sectionSignature(sections) === sectionSignature(model.sections)) return model;
  return { ...model, sections };
}

/**
 * Rewrite the sequential-row list so the table1 block follows the model's
 * section order, membership, labels and phenotype display names. Rows from
 * other categories are left untouched; the whole list is re-indexed.
 */
export function applyOutlineModel(
  baseRows: SequentialRow[],
  model: OutlineModel,
  rowPredicate: (r: SequentialRow) => boolean = isOutlineRow,
): SequentialRow[] {
  const byName = new Map<string, SequentialRow>();
  for (const row of baseRows) {
    if (rowPredicate(row)) byName.set(row.name, row);
  }

  // Derive category/reporter from the first matching row for use in placeholders.
  const firstMatch = baseRows.find(rowPredicate);

  const block: SequentialRow[] = [];
  for (const section of model.sections) {
    const sectionRows: SequentialRow[] = [];
    for (const name of section.itemNames) {
      const row = byName.get(name);
      if (!row) continue;
      sectionRows.push({
        ...row,
        section: section.displayName,
        sectionId: section.id,
        displayName: model.phenotypeNames[name] ?? row.displayName,
      });
    }
    if (sectionRows.length > 0) {
      block.push(...sectionRows);
    } else if (firstMatch) {
      // Empty section: inject a placeholder so it remains visible in the accordion.
      block.push({
        index: 0,
        category: firstMatch.category,
        reporter: firstMatch.reporter,
        section: section.displayName,
        sectionId: section.id,
        name: `__placeholder__${section.id}`,
        rowType: 'section_placeholder',
        registry: null,
      });
    }
  }

  const result: SequentialRow[] = [];
  let inserted = false;
  for (const row of baseRows) {
    if (rowPredicate(row)) {
      if (!inserted) {
        result.push(...block);
        inserted = true;
      }
      continue;
    }
    result.push(row);
  }
  if (!inserted) result.push(...block);

  return result.map((row, index) => (row.index === index ? row : { ...row, index }));
}

// ── Editing operations (pure) ───────────────────────────────────────────

/** Move a phenotype into `targetSectionId`, before `beforeName` (or append). */
export function movePhenotype(
  model: OutlineModel,
  name: string,
  targetSectionId: string,
  beforeName: string | null,
): OutlineModel {
  const sections = model.sections.map((section) => ({
    ...section,
    itemNames: section.itemNames.filter((n) => n !== name),
  }));
  const target = sections.find((s) => s.id === targetSectionId);
  if (!target) return model;

  const at = beforeName ? target.itemNames.indexOf(beforeName) : -1;
  if (at === -1) target.itemNames.push(name);
  else target.itemNames.splice(at, 0, name);

  return { ...model, sections };
}

/** Set a phenotype's editable display label. */
export function renamePhenotype(model: OutlineModel, name: string, displayName: string): OutlineModel {
  return { ...model, phenotypeNames: { ...model.phenotypeNames, [name]: displayName } };
}

/** Set a section's editable display label. */
export function renameSection(model: OutlineModel, sectionId: string, displayName: string): OutlineModel {
  return {
    ...model,
    sections: model.sections.map((s) => (s.id === sectionId ? { ...s, displayName } : s)),
  };
}

/** Append a new empty user-created section to the model. */
export function addSection(model: OutlineModel, displayName: string): OutlineModel {
  // Use a unique ID so duplicate names don't collide across multiple user-created sections.
  const id = `osecuser:${displayName}:${Date.now()}`;
  return { ...model, sections: [...model.sections, { id, displayName, itemNames: [] }] };
}
