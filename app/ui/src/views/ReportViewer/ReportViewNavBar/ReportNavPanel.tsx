import { FC, ReactNode } from 'react';
import styles from './ReportNavPanel.module.css';

interface ReportNavPanelProps {
  top?: ReactNode;
  center?: ReactNode;
  bottom?: ReactNode;
}

export const ReportNavPanel: FC<ReportNavPanelProps> = ({ top, center, bottom }) => (
  <div className={styles.panel}>
    <div className={styles.top}>{top}</div>
    <div className={styles.center}>{center}</div>
    <div className={styles.bottom}>{bottom}</div>
  </div>
);
