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

/** True for rows that participate in the editable outline. */
export function isOutlineRow(row: SequentialRow): boolean {
  return row.category === OUTLINE_CATEGORY && row.reporter === OUTLINE_REPORTER;
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `osec-${Math.random().toString(36).slice(2)}`;
}

/**
 * Build the initial editable model from the source sequential rows, mirroring
 * the table1 `sections` grouping (sectionless phenotypes fall into "Other").
 */
export function deriveOutlineModel(baseRows: SequentialRow[]): OutlineModel {
  const sections: OutlineSection[] = [];
  const byLabel = new Map<string, OutlineSection>();

  for (const row of baseRows) {
    if (!isOutlineRow(row)) continue;
    const label = row.section ?? UNGROUPED_SECTION;
    let section = byLabel.get(label);
    if (!section) {
      section = { id: newId(), displayName: label, itemNames: [] };
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
export function reconcileOutlineModel(model: OutlineModel, baseRows: SequentialRow[]): OutlineModel {
  const currentNames: string[] = [];
  const baseSectionByName = new Map<string, string>();
  for (const row of baseRows) {
    if (!isOutlineRow(row)) continue;
    currentNames.push(row.name);
    baseSectionByName.set(row.name, row.section ?? UNGROUPED_SECTION);
  }
  const currentSet = new Set(currentNames);

  const placed = new Set<string>();
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
      section = { id: newId(), displayName: label, itemNames: [] };
      sections.push(section);
    }
    section.itemNames.push(name);
  }

  const cleaned = sections.filter((s) => s.itemNames.length > 0);
  if (sectionSignature(cleaned) === sectionSignature(model.sections)) return model;
  return { ...model, sections: cleaned };
}

/**
 * Rewrite the sequential-row list so the table1 block follows the model's
 * section order, membership, labels and phenotype display names. Rows from
 * other categories are left untouched; the whole list is re-indexed.
 */
export function applyOutlineModel(baseRows: SequentialRow[], model: OutlineModel): SequentialRow[] {
  const byName = new Map<string, SequentialRow>();
  for (const row of baseRows) {
    if (isOutlineRow(row)) byName.set(row.name, row);
  }

  const block: SequentialRow[] = [];
  for (const section of model.sections) {
    for (const name of section.itemNames) {
      const row = byName.get(name);
      if (!row) continue;
      block.push({
        ...row,
        section: section.displayName,
        sectionId: section.id,
        displayName: model.phenotypeNames[name] ?? row.displayName,
      });
    }
  }

  const result: SequentialRow[] = [];
  let inserted = false;
  for (const row of baseRows) {
    if (isOutlineRow(row)) {
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

  return { ...model, sections: sections.filter((s) => s.itemNames.length > 0) };
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
