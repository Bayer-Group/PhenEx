import { memo } from 'react';
import { type CohortClassified } from '../types';
import { type BarChartSpacer } from '../GraphsAndTables/RowRenderers/barChartShared';
import { type SequentialRow } from '../studyRegistryUtils';
import { type TimeToEventCohort, type Table2Cohort } from '../GraphsAndTables/OutcomesChart';
import { SectionRowRenderer, sectionRowTitle } from './SectionRowRenderer';
import styles from './SectionListContent.module.css';

// ── Props ────────────────────────────────────────────────────────────────

export interface SectionListContentProps {
  rows: SequentialRow[];
  cohortData: CohortClassified[];
  finalCohortSizes?: Record<string, number | null>;
  spacers?: BarChartSpacer[];
  tteCohorts?: TimeToEventCohort[];
  table2Cohorts?: Table2Cohort[];
  onNavigateToRow?: (row: SequentialRow) => void;
}

/**
 * The default section view: a vertical list where each row shows its title on
 * the left and its (shared) chart content on the right.
 */
export const SectionListContent = memo<SectionListContentProps>(({
  rows,
  cohortData,
  finalCohortSizes,
  spacers,
  tteCohorts,
  table2Cohorts,
  onNavigateToRow,
}) => {
  return (
    <div className={styles.multiRowList}>
      {rows.map((row, index) => {
        const hideBarChartHeader = row.rowType === 'boolean'
          && index > 0
          && rows[index - 1].rowType === 'boolean';

        return (
          <div
            key={row.index}
            className={styles.multiRowBlock}
            onClick={(e) => { e.stopPropagation(); onNavigateToRow?.(row); }}
          >
            <div className={styles.multiRowTitle}>
              {sectionRowTitle(row)}
            </div>
            <div className={styles.multiRowContent}>
              <SectionRowRenderer
                row={row}
                cohortData={cohortData}
                finalCohortSizes={finalCohortSizes}
                spacers={spacers}
                tteCohorts={tteCohorts}
                table2Cohorts={table2Cohorts}
                hideBarChartHeader={hideBarChartHeader}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
});
