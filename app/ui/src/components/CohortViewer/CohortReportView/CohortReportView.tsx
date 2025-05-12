import { FC, useState } from 'react';
import styles from './CohortReportView.module.css';
import { CohortDataService } from '../CohortDataService/CohortDataService';
import { TableData } from '../tableTypes';
import { Tabs } from '../../Tabs/Tabs';
import { ReportCard } from './ReportCard';
interface CohortReportViewProps {
  data?: string;
}

enum CohortReportViewType {
  Cohort = 'cohort',
  Baseline = 'baseline',
  Outcomes = 'outcomes',
}

export const CohortReportView: FC<CohortReportViewProps> = ({ data }) => {
  const [dataService] = useState(() => CohortDataService.getInstance());
  const [currentView, setCurrentView] = useState<CohortReportViewType>(CohortReportViewType.Cohort);

  const tabs = Object.values(CohortReportViewType).map(value => {
    return value.charAt(0).toUpperCase() + value.slice(1);
  });

  const onTabChange = (index: number) => {
    const viewTypes = Object.values(CohortReportViewType);
    const selectedView = viewTypes[index];
    setCurrentView(selectedView);
    document.getElementById(selectedView)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const renderViewContent = () => {
    switch (currentView) {
      case CohortReportViewType.Cohort:
        return (
          <>
          
            <ReportCard title={'Attrition Table'} dataService={dataService.report_service} />
          </>
        );
      // case CohortReportViewType.Baseline:
      //   return (
      //     <>
      //       <ReportCard title={'Age'} />
      //       <ReportCard title={'Sex'} />
      //       <ReportCard title={'Ethnicity'} />
      //       <ReportCard title={'Baseline Characteristics'} />
      //     </>
      //   );
      // case CohortReportViewType.Outcomes:
      //   return <ReportCard title={'Outcomes'} />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      {/* <div className={styles.topSection}>
        <div className={styles.controlsContainer}>
          <Tabs
            width={400}
            height={25}
            tabs={tabs}
            onTabChange={onTabChange}
            active_tab_index={Object.values(CohortReportViewType).indexOf(currentView)}
          />
        </div>
      </div> */}
      {/* <div className={styles.bottomSection}> */}
        <div className={styles.viewContainer}>{renderViewContent()}</div>
      {/* </div> */}
    </div>
  );
};
