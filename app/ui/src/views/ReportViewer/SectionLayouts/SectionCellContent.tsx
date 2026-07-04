import { memo } from 'react';
import { type CohortClassified } from '../types';
import { type BarChartSpacer } from '../GraphsAndTables/RowRenderers/barChartShared';
import { type SequentialRow } from '../studyRegistryUtils';
import { type TimeToEventCohort, type Table2Cohort } from '../GraphsAndTables/OutcomesChart';
import { SectionListContent } from './SectionListContent';
import { SectionGridContent } from './SectionGridContent';
import { useSectionLayouts } from './sectionLayoutStore';

// ── Props ────────────────────────────────────────────────────────────────

export interface SectionCellContentProps {
  /** Stable id used to look up / persist this section's layouts. */
  sectionId: string;
  rows: SequentialRow[];
  cohortData: CohortClassified[];
  finalCohortSizes?: Record<string, number | null>;
  spacers?: BarChartSpacer[];
  tteCohorts?: TimeToEventCohort[];
  table2Cohorts?: Table2Cohort[];
  onNavigateToRow?: (row: SequentialRow) => void;
}

/**
 * Chooses between the two mutually-exclusive section views based on the
 * section's active layout: no active layout ⇒ list view; an active grid layout
 * ⇒ grid view. The two views are fully separate components sharing only the
 * chart renderers.
 */
export const SectionCellContent = memo<SectionCellContentProps>((props) => {
  const { sectionId, ...rest } = props;
  const { activeLayout } = useSectionLayouts(sectionId);

  if (activeLayout) {
    return <SectionGridContent sectionId={sectionId} layout={activeLayout} {...rest} />;
  }
  return <SectionListContent {...rest} />;
});
