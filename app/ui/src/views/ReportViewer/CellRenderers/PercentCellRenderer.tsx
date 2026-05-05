import { FC } from 'react';
import { type CohortClassified } from '../types';
import styles from './PercentCellRenderer.module.css';

export const PercentCellRenderer: FC<any> = ({ data }) => {
  const { cohortData } = data._meta;
  const { name } = data;

  return (
    <div className={styles.container}>
      {cohortData.map((cd: CohortClassified, i: number) => {
        const row = cd.classified.booleans.find((r) => r.Name === name);
        const pct = row?.Pct ?? 0;
        return (
          <div key={i} className={styles.row}>
            <strong>{Math.round(pct * 10) / 10}</strong>
            <span className={styles.percent}>%</span>
          </div>
        );
      })}
    </div>
  );
};
