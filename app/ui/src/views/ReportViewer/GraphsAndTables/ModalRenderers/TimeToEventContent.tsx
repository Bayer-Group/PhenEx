import { FC, useEffect, useMemo, useState } from 'react';
import { type TimeToEventCohort } from '../OutcomesChart';
import { KaplanMeierCellRenderer, type KMCurve } from '../RowRenderers/KaplanMeierCellRenderer';
import styles from './TimeToEventContent.module.css';

interface TimeToEventContentProps {
  outcome: string;
  cohorts: TimeToEventCohort[];
  availableOutcomes?: string[];
}

const DASH_PATTERNS = ['0', '10 4', '4 4', '14 4 4 4', '2 3', '16 6'];

export const TimeToEventContent: FC<TimeToEventContentProps> = ({ outcome, cohorts, availableOutcomes }) => {
  const inferredOutcomes = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const cohort of cohorts) {
      for (const row of cohort.timeToEvent) {
        if (!seen.has(row.Outcome)) {
          seen.add(row.Outcome);
          names.push(row.Outcome);
        }
      }
    }
    return names;
  }, [cohorts]);

  const outcomeOptions = availableOutcomes?.length ? availableOutcomes : inferredOutcomes;
  const [selectedOutcomes, setSelectedOutcomes] = useState<string[]>([outcome]);

  useEffect(() => {
    setSelectedOutcomes([outcome]);
  }, [outcome]);

  const curves: KMCurve[] = useMemo(
    () => selectedOutcomes.flatMap((selectedOutcome, outcomeIndex) =>
      cohorts
        .map((cohort) => ({
          color: cohort.color,
          cohortName: selectedOutcomes.length > 1 ? `${cohort.name} · ${selectedOutcome}` : cohort.name,
          dashArray: DASH_PATTERNS[outcomeIndex % DASH_PATTERNS.length],
          steps: cohort.timeToEvent.filter((row) => row.Outcome === selectedOutcome),
        }))
        .filter((curve) => curve.steps.length > 0),
    ),
    [cohorts, selectedOutcomes],
  );

  const toggleOutcome = (nextOutcome: string) => {
    setSelectedOutcomes((current) => {
      if (current.includes(nextOutcome)) {
        if (current.length === 1) return current;
        return current.filter((value) => value !== nextOutcome);
      }
      return [...current, nextOutcome];
    });
  };

  if (!curves.length) {
    return <div className={styles.empty}>No time-to-event data for this outcome.</div>;
  }

  return (
    <div className={styles.container}>
      {outcomeOptions.length > 1 && (
        <div className={styles.selectorBlock}>
          <div className={styles.selectorLabel}>Overlay outcomes</div>
          <div className={styles.selectorList}>
            {outcomeOptions.map((option) => {
              const checked = selectedOutcomes.includes(option);
              return (
                <label key={option} className={`${styles.selectorChip} ${checked ? styles.selectorChipActive : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOutcome(option)}
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
      <div className={styles.chartCard}>
        <KaplanMeierCellRenderer curves={curves} mode="full" />
      </div>
    </div>
  );
};
