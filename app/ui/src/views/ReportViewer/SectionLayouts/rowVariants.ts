import type { RowType } from '../studyRegistryUtils';

/**
 * Alternate chart display variants for a section row, keyed by {@link RowType}.
 *
 * Only row types with more than one meaningful presentation appear here; every
 * other row type renders a single fixed chart. The first entry of each list is
 * the default. {@link SectionRowRenderer} maps a variant id to a concrete
 * renderer; the multiselect toolbar's "change display type" action cycles a
 * row through its list.
 */
export interface RowVariant {
  id: string;
  label: string;
}

export const ROW_VARIANTS: Partial<Record<RowType, RowVariant[]>> = {
  numeric: [
    { id: 'boxplot', label: 'Box plot' },
    { id: 'table', label: 'Table' },
  ],
  categorical: [
    { id: 'vertical', label: 'Vertical bars' },
    { id: 'horizontal', label: 'Horizontal bars' },
  ],
};

/** Variants available for a row type (empty when it has none). */
export function variantsFor(rowType: RowType): RowVariant[] {
  return ROW_VARIANTS[rowType] ?? [];
}

/** Whether a row type offers more than one display variant. */
export function hasVariants(rowType: RowType): boolean {
  return variantsFor(rowType).length > 1;
}

/** The variant id after `current` (wrapping); the default when unset/unknown. */
export function nextVariant(rowType: RowType, current: string | undefined): string {
  const variants = variantsFor(rowType);
  if (variants.length === 0) return current ?? '';
  const i = variants.findIndex((v) => v.id === current);
  return variants[(i + 1) % variants.length].id;
}
