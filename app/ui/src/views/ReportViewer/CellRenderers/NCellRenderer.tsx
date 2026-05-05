import { FC } from 'react';
import { type CohortClassified } from '../types';
import styles from './NCellRenderer.module.css';

export const NCellRenderer: FC<any> = ({ data }) => {
  const { cohortData } = data._meta;
  const { name } = data;

  return (
    <div className={styles.container}>
      {cohortData.map((cd: CohortClassified, i: number) => {
        const row = cd.classified.booleans.find((r) => r.Name === name);
        const n = row?.N ?? 0;
        return (
          <div key={i} className={styles.row}>
            {n}
          </div>
        );
      })}
    </div>
  );
};
