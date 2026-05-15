import { FC, useMemo } from 'react';
import { type TimeToEventCohort } from '../OutcomesChart';
import { KaplanMeierCellRenderer, type KMCurve } from '../RowRenderers/KaplanMeierCellRenderer';
import styles from './TimeToEventContent.module.css';

interface TimeToEventContentProps {
  outcome: string;
  cohorts: TimeToEventCohort[];
}

export const TimeToEventContent: FC<TimeToEventContentProps> = ({ outcome, cohorts }) => {
  const curves: KMCurve[] = useMemo(
    () =>
      cohorts
        .map((c) => ({
          color: c.color,
          cohortName: c.name,
          steps: c.timeToEvent.filter((r) => r.Outcome === outcome),
        }))
        .filter((c) => c.steps.length > 0),
    [cohorts, outcome],
  );

  if (!curves.length) {
    return <div className={styles.empty}>No time-to-event data for this outcome.</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.chartCard}>
        <KaplanMeierCellRenderer curves={curves} mode="full" />
      </div>
    </div>
  );
};
