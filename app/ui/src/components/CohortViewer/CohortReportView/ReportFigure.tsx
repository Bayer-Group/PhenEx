import { FC } from 'react';
import { ReportDataService } from './ReportDataService';
import styles from './CohortReportView.module.css';

interface ReportFigureProps {
  dataService: ReportDataService;
}

export const ReportFigure: FC<ReportFigureProps> = ({ dataService }) => {
  // Placeholder for future chart implementation
  return (
    <div className={styles.reportFigure}>
      <p>Chart visualization will be implemented here</p>
      <p>Data available: {dataService.getRowData().length} records</p>
    </div>
  );
};