import { FC } from 'react';
import { ReportSelector } from './ReportFloatingControls/ReportSelector';
import type { Report } from './types';

interface ReportsPanelProps {
  reports: Report[];
  onSelect?: (report: Report) => void;
}

export const ReportsPanel: FC<ReportsPanelProps> = ({ reports, onSelect }) => {
  return (
    <ReportSelector
      reports={reports}
      onSelect={onSelect ?? (() => {})}
    />
  );
};
