import { FC } from 'react';
import type { Report } from '../types';
import styles from './ReportSelector.module.css';

interface ReportSelectorProps {
  reports: Report[];
  onSelect: (report: Report) => void;
}

export const ReportSelector: FC<ReportSelectorProps> = ({ reports, onSelect }) => {
  return (
    <div className={styles.container}>
      {reports.map((report) => (
        <div
          key={report.report_id}
          className={styles.card}
          onClick={() => onSelect(report)}
        >
          <div className={styles.cardHeader}>{report.display_name}</div>
          {report.description && (
            <div className={styles.cardDescription}>{report.description}</div>
          )}
          <div className={styles.cardMeta}>
            {report.rows.length} row{report.rows.length !== 1 ? 's' : ''} · {report.type}
          </div>
        </div>
      ))}
    </div>
  );
};
