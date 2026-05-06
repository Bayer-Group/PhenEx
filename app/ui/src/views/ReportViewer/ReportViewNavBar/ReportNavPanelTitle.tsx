import { FC } from 'react';
import styles from './ReportNavPanelTitle.module.css';

interface ReportNavPanelTitleProps {
  title: string;
}

export const ReportNavPanelTitle: FC<ReportNavPanelTitleProps> = ({ title }) => (
  <div className={styles.title}>{title}</div>
);
