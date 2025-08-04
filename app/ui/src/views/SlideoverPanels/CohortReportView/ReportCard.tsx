import { FC } from 'react';
import { ReportDataService } from './ReportDataService';
import { ReportFigure } from './ReportFigure';
import { ReportTable } from './ReportTable';
import styles from './ReportCard.module.css';

interface ReportCardProps {
  title: string;
  onInfoClick?: () => void;
  dataService: ReportDataService;
}

export const ReportCard: FC<ReportCardProps> = ({ title, onInfoClick, dataService }) => {
  return (
    <div className={styles.reportCard}>
      <div className={styles.reportCardHeader}>
        <h3 className={styles.reportCardTitle}>{title}</h3>
        {onInfoClick && (
          <button className={styles.infoButton} onClick={onInfoClick} aria-label="More information">
            ℹ️
          </button>
        )}
      </div>
      <div className={styles.reportCardBody}>
        {/* <ReportFigure dataService={dataService} /> */}
        <ReportTable dataService={dataService} />
      </div>
    </div>
  );
};
