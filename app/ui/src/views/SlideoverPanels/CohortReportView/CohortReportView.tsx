import { FC, useState, useEffect } from 'react';
import styles from './CohortReportView.module.css';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';

import { ReportTable } from './ReportTable';
import { Tabs } from '../../../components/ButtonsAndTabs/Tabs/Tabs';
interface CohortReportViewProps {
  data?: string;
}

enum CohortReportViewType {
  Attrition = 'attrition',
  Table1 = 'table1',
  Outcomes = 'outcomes',
  KaplanMeier = 'KaplanMeier',
}

enum GraphViewType {
  Table = 'table',
  Graph = 'graph',
}

export const CohortReportView: FC<CohortReportViewProps> = ({ data }) => {
  const [dataService] = useState(() => CohortDataService.getInstance());
  const [currentView, setCurrentView] = useState<CohortReportViewType>(
    CohortReportViewType.Attrition
  );
  const [currentGraphView, setCurrentGraphView] = useState<GraphViewType>(
    GraphViewType.Table
  );

  const [, forceUpdate] = useState({});

  useEffect(() => {
    const handleDataServiceUpdate = () => {
      forceUpdate({}); // Trigger a re-render when dataService changes
    };

    dataService.addListener(handleDataServiceUpdate);
    return () => {
      dataService.removeListener(handleDataServiceUpdate);
    };
  }, [dataService]);

  const tabs = Object.values(CohortReportViewType).map(value => {
    return value.charAt(0).toUpperCase() + value.slice(1);
  });
  const graphTabs = Object.values(GraphViewType).map(value => {
    return value.charAt(0).toUpperCase() + value.slice(1);
  });
  const onTabChange = (index: number) => {
    const viewTypes = Object.values(CohortReportViewType);
    const selectedView = viewTypes[index];
    setCurrentView(selectedView);
    document.getElementById(selectedView)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const onGraphTabChange = (index: number) => {
    const viewTypes = Object.values(GraphViewType);
    const selectedView = viewTypes[index];
    setCurrentGraphView(selectedView);
    console.log("CHANGING", selectedView)
  };

  const renderAttrition = () =>{
    console.log("RENDERING ATTRITION", currentGraphView)
    switch (currentGraphView){
      case GraphViewType.Table:
        console.log("RENDERING THE TABLE")
        return <ReportTable dataService={dataService.report_service} />;
      case GraphViewType.Graph:
        console.log("RENDERING THE GRAPH");
        return null;
    }
  }

  const renderViewContent = () => {
    switch (currentView) {
      case CohortReportViewType.Attrition:
        dataService.report_service.setCurrentDataKey('waterfall');
        renderAttrition();
      case CohortReportViewType.Table1:
        dataService.report_service.setCurrentDataKey('table1');
        return (
          <>
            <ReportTable dataService={dataService.report_service} />
          </>
        );
      default:
        return null;
    }
  };

  const infoContent = () => {
    return (
      <span>
        <i>View results of cohort execution</i>
        <br></br>
        After you've resolved all issues and executed your cohort, you can view the results of the
        most recent execution here.
        <ul>
          <li>
            <em>Attrition diagrams</em> : Click the attrition tab to see how your entry, inclusion
            and exclusion criteria interact to build your final cohort. Phenotypes are run in order
            they are displayed in the cohort phenotype editor.
            <ul>
              <li>The N column displays how many patients in the cohort meet each criterion</li>
              <li>
                The Waterfall column displays how many patients remain after executing the phenotype
                on that row in order
              </li>
              <li>
                The delta column displays how many patients were lost after applying the phenotype
                in that row in order
              </li>
            </ul>
          </li>
          <li>
            <em>Table 1</em> displays your baseline characteristics. The N column displays how many
            patients in the cohort fulfill the criteria in the row. Summary statistics are shown for
            numerically valued phenotypes. Categorical phenotypes are split into separate rows.
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
            tabs={tabs}
            onTabChange={onTabChange}
            active_tab_index={Object.values(CohortReportViewType).indexOf(currentView)}
          />
          <Tabs
            tabs={graphTabs}
            onTabChange={onGraphTabChange}
            active_tab_index={Object.values(GraphViewType).indexOf(currentGraphView)}
          />
        </div>
        <div className={styles.bottomSection}>{renderViewContent()}</div>
      </div>
    </SlideoverPanel>
  );
};
