import { memo } from 'react';
import { type CohortClassified } from '../types';
import { type BarChartSpacer } from '../GraphsAndTables/RowRenderers/barChartShared';
import { type SequentialRow } from '../studyRegistryUtils';
import { type TimeToEventCohort, type Table2Cohort } from '../GraphsAndTables/OutcomesChart';
import { SectionRowRenderer, sectionRowTitle } from './SectionRowRenderer';
import styles from './GroupCard.module.css';

export interface GroupCardProps {
  members: SequentialRow[];
  cohortData: CohortClassified[];
  finalCohortSizes?: Record<string, number | null>;
  spacers?: BarChartSpacer[];
  tteCohorts?: TimeToEventCohort[];
  table2Cohorts?: Table2Cohort[];
  displayVariants: Record<string, string>;
}

/**
 * Body of a group cell: its member rows stacked vertically, each with a compact
 * caption. Chart rendering is delegated to the shared {@link SectionRowRenderer}
 * so grouped cells look identical to their loose counterparts.
 */
export const GroupCard = memo<GroupCardProps>(({
  members,
  cohortData,
  finalCohortSizes,
  spacers,
  tteCohorts,
  table2Cohorts,
  displayVariants,
}) => (
  <div className={styles.stack}>
    {members.map((row) => (
      <div key={row.name} className={styles.member}>
        <div className={styles.memberTitle} title={sectionRowTitle(row)}>
          {sectionRowTitle(row)}
        </div>
        <div className={styles.memberBody}>
          <SectionRowRenderer
            row={row}
            cohortData={cohortData}
            finalCohortSizes={finalCohortSizes}
            spacers={spacers}
            tteCohorts={tteCohorts}
            table2Cohorts={table2Cohorts}
            variant={displayVariants[row.name]}
            fillHeight={row.rowType === 'boolean' || row.rowType === 'numeric' || row.rowType === 'categorical'}
          />
        </div>
      </div>
    ))}
  </div>
));

GroupCard.displayName = 'GroupCard';
