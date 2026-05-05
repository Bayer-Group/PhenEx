import { FC } from 'react';
import styles from './AnalysisCellRenderer.module.css';

export const AnalysisCellRenderer: FC<any> = (params) => {
  return (
    <div className={styles.analysisCell}>
      <p className={styles.analysisText}>{params.value}</p>
    </div>
  );
};
