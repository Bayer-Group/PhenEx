import { FC } from 'react';
import styles from './PrefillProgressPanel.module.css';

export type CohortPrefillStatus = 'waiting' | 'active' | 'done';

export interface CohortPrefillItem {
  name: string;
  status: CohortPrefillStatus;
}

interface PrefillProgressPanelProps {
  cohorts: CohortPrefillItem[];
  onDismiss: () => void;
}

const StatusIcon: FC<{ status: CohortPrefillStatus }> = ({ status }) => {
  if (status === 'done') return <span className={styles.iconDone}>✓</span>;
  if (status === 'active') return <span className={styles.iconActive}>✦</span>;
  return <span className={styles.iconWaiting}>○</span>;
};

export const PrefillProgressPanel: FC<PrefillProgressPanelProps> = ({ cohorts, onDismiss }) => {
  const allDone = cohorts.every(c => c.status === 'done');

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>
          {allDone ? '✓ Prefill complete' : '✦ AI prefilling study…'}
        </span>
        {allDone && (
          <button className={styles.dismissBtn} onClick={onDismiss}>Dismiss</button>
        )}
      </div>

      <ul className={styles.cohortList}>
        {cohorts.map((c, i) => (
          <li key={i} className={`${styles.cohortItem} ${styles[`status_${c.status}`]}`}>
            <StatusIcon status={c.status} />
            <span className={styles.cohortName}>{c.name}</span>
            {c.status === 'active' && <span className={styles.workingLabel}>working…</span>}
            {c.status === 'waiting' && <span className={styles.waitingLabel}>queued</span>}
          </li>
        ))}
      </ul>

      <p className={styles.hint}>See chat panel for details</p>
    </div>
  );
};
