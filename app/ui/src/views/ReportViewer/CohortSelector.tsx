import { FC } from 'react';
import { COLORS } from './types';
import styles from './ReportViewer.module.css';

interface CohortSelectorProps {
  cohortNames: string[];
  selected: Set<string>;
  onToggle: (name: string) => void;
}

export const CohortSelector: FC<CohortSelectorProps> = ({ cohortNames, selected, onToggle }) => (
  <div className={styles.controls}>
    <label className={styles.controlLabel}>Cohorts:</label>
    {cohortNames.map((name, ci) => {
      const color = COLORS[ci % COLORS.length];
      const active = selected.has(name);
      return (
        <button
          key={name}
          className={`${styles.cohortBtn} ${active ? styles.cohortBtnActive : ''}`}
          style={
            active
              ? { borderColor: color, background: color, color: '#fff' }
              : { borderColor: '#ccc', background: '#fff', color: '#333' }
          }
          onClick={() => onToggle(name)}
        >
          {name}
        </button>
      );
    })}
  </div>
);
