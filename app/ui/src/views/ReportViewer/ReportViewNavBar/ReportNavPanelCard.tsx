import { FC, ReactNode } from 'react';
import styles from './ReportNavPanelCard.module.css';

interface ReportNavPanelCardProps {
  title: string;
  children: ReactNode;
}

export const ReportNavPanelCard: FC<ReportNavPanelCardProps> = ({ title, children }) => (
  <div className={styles.card}>
    <div className={styles.title}>{title}</div>
    {children}
  </div>
);
