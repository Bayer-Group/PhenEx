import { FC, ReactNode } from 'react';
import styles from './ChartGroup.module.css';

interface ChartGroupProps {
  title: string;
  children: ReactNode;
}

export const ChartGroup: FC<ChartGroupProps> = ({ title, children }) => {
  return (
    <div className={styles.chartGroup}>
      <div className={styles.title}>{title}</div>
      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
};
