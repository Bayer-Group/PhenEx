import { FC } from 'react';
import { type Table2Cohort } from '../OutcomesChart';
import styles from './Table2Content.module.css';

const COLS = ['N_Events', 'N_Censored', 'Incidence_Rate'] as const;
const LABELS: Record<string, string> = {
  N_Events: 'Events',
  N_Censored: 'Censored',
  Incidence_Rate: 'Incidence Rate',
};

const fmt = (v: number | null | undefined) => {
  if (v == null || isNaN(v)) return '–';
  return v % 1 !== 0 ? v.toFixed(2) : String(v);
};

interface Table2ContentProps {
  outcome: string;
  cohorts: Table2Cohort[];
}

export const Table2Content: FC<Table2ContentProps> = ({ outcome, cohorts }) => {
  const rows = cohorts
    .map((c) => ({ cohort: c, row: c.table2.find((r) => r.Outcome === outcome) }))
    .filter((r) => r.row);

  if (!rows.length) {
    return <div className={styles.empty}>No incidence rate data for this outcome.</div>;
  }

  return (
    <div className={styles.container}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.cohortHeader} />
            {COLS.map((k) => (
              <th key={k} className={styles.header}>{LABELS[k] ?? k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ cohort, row }) => (
            <tr key={cohort.name} className={styles.row}>
              <td className={styles.cohortCell}>
                <span className={styles.dot} style={{ backgroundColor: cohort.color }} />
                <span className={styles.cohortName}>{cohort.name}</span>
              </td>
              {COLS.map((k) => (
                <td key={k} className={styles.valueCell}>{fmt(row![k])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
