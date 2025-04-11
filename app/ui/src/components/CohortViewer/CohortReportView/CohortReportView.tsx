import { FC, useState } from 'react';
import styles from './CohortReportView.module.css';
import { CohortDataService } from '../CohortDataService/CohortDataService';
import { TableData } from '../tableTypes';
import { CohortTable } from '../CohortTable/CohortTable';
import { Tabs } from '../../Tabs/Tabs';

interface CohortReportViewProps {
  data?: string;
}

enum CohortReportViewType {
  Cohort = 'cohort',
  Baseline = 'baseline',
  Outcomes = 'outcomes',
}

export const CohortReportView: FC<CohortReportViewProps> = ({ data }) => {
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [dataService] = useState(() => CohortDataService.getInstance());
  const [currentView, setCurrentView] = useState<CohortReportViewType>(CohortReportViewType.Cohort);

  const renderView = () => {
    switch (currentView) {
      case CohortReportViewType.Cohort:
        return <CohortTable data={dataService.table_data} onCellValueChanged={() => {}} />;
      case CohortReportViewType.Baseline:
        return (
          <div className={styles.viewContainer}>
            <h2>Baseline Characteristics</h2>
            <p>View baseline characteristics for your cohort here.</p>
          </div>
        );
      case CohortReportViewType.Outcomes:
        return (
          <div className={styles.viewContainer}>
            <h2>Outcomes Report</h2>
            <p>View outcome measures for your cohort here.</p>
          </div>
        );
      default:
        return null;
    }
  };

  const tabs = Object.values(CohortReportViewType).map(value => {
    return value.charAt(0).toUpperCase() + value.slice(1);
  });

  const onTabChange = (index: number) => {
    const viewTypes = Object.values(CohortReportViewType);
    setCurrentView(viewTypes[index]);
  };

  return (
    <div className={styles.cohortTableContainer}>
      <div className={styles.topSection}>
        <div className={styles.controlsContainer}>
          <Tabs
            width={400}
            height={25}
            tabs={tabs}
            onTabChange={onTabChange}
            active_tab_index={Object.values(CohortReportViewType).indexOf(currentView)}
          />
        </div>
      </div>
      <div className={styles.bottomSection}>{renderView()}</div>
    </div>
  );
};
