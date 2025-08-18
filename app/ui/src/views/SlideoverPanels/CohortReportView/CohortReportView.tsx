import { FC, useState, useEffect } from 'react';
import styles from './CohortReportView.module.css';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';

import { ReportTable } from './ReportTable';
import { Tabs } from '../../../components/ButtonsAndTabs/Tabs/Tabs'
interface CohortReportViewProps {
  data?: string;
}

enum CohortReportViewType {
  Attrition = 'attrition',
  Table1 = 'table1',
  Outcomes = 'outcomes',
  KaplanMeier = 'KaplanMeier'
}

export const CohortReportView: FC<CohortReportViewProps> = ({ data }) => {
  const [dataService] = useState(() => CohortDataService.getInstance());
  const [currentView, setCurrentView] = useState<CohortReportViewType>(CohortReportViewType.Attrition);
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const handleDataServiceUpdate = () => {
      forceUpdate({});  // Trigger a re-render when dataService changes
    };

    dataService.addListener(handleDataServiceUpdate);
    return () => {
      dataService.removeListener(handleDataServiceUpdate);
    };
  }, [dataService]);

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
      case CohortReportViewType.Attrition:
        return (
          <>
            <ReportTable dataService={dataService.report_service} />
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

  const infoContent = () => {
    return (
      <span>
        <i>View results of cohort execution</i>
        <ul>
          <li>
            <em>Attrition diagrams</em> : Click the attrition tab to see how your entry, inclusion and exclusion criteria interact to build your final cohort. Phenotypes are run in order they are displayed in the cohort phenotype editor. 
            <ul>
              <li>The N column displays how many patients in the cohort meet each criterion</li>
              <li>The Waterfall column displays how many patients remain after executing the phenotype on that row in order</li>
              <li>The delta column displays how many patients were lost after applying the phenotype in that row in order</li>
            </ul>
          </li>
          <li>
            <em>Table 1</em> displays your baseline characteristics. The N column displays how many patients in the cohort fulfill the criteria in the row. Summary statistics are shown for numerically valued phenotypes. Categorical phenotypes are split into separate rows.
          </li>
          <li>
            <em>Kaplan Meier plots</em> are provided for all outcomes.
          </li>
        </ul>
      </span>
    );
  };


  return (
    <SlideoverPanel title="Report" info={infoContent()}>
      <div className={styles.container}>
        <div className={styles.controlsContainer}>
          <Tabs
            width={400}
            height={25}
            tabs={tabs}
            onTabChange={onTabChange}
            active_tab_index={Object.values(CohortReportViewType).indexOf(currentView)}
          />
        </div>
        <div className={styles.bottomSection}>{renderViewContent()}</div>
      </div>
    </SlideoverPanel>
  );
};
