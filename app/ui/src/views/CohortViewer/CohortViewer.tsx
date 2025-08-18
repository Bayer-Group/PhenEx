import { FC, useState, useRef, useEffect } from 'react';
import styles from './CohortViewer.module.css';
import { CohortDataService } from './CohortDataService/CohortDataService';
import { TableData } from './tableTypes';
import { CohortTable } from './CohortTable/CohortTable';
import { CohortInfo } from './CohortInfo/CohortInfo';
import { CohortDefinitionView } from './CohortDefinitionView/CohortDefinitionView';
import { TwoPanelCohortViewerService } from './TwoPanelCohortViewer/TwoPanelCohortViewer';
import { CohortReportView } from '../SlideoverPanels/CohortReportView/CohortReportView';
import { IssuesDisplayControl } from './CohortIssuesDisplay/IssuesDisplayControl';
import { EditableTextField } from '../../components/EditableTextField/EditableTextField';
import { AppNavigationTabBar } from './CohortDefinitionView/AppNavigationTabBar';

interface CohortViewerProps {
  data?: string;
  onAddPhenotype?: () => void;
}

export enum CohortViewType {
  Info = 'info',
  CohortDefinition = 'definition',
  Report = 'report',
}

export const CohortViewer: FC<CohortViewerProps> = ({ data, onAddPhenotype }) => {
  const [cohortName, setCohortName] = useState(data ?? '');
  const gridRef = useRef<any>(null);
  const [dataService] = useState(() => CohortDataService.getInstance());
  const [currentView, setCurrentView] = useState<CohortViewType>(CohortViewType.CohortDefinition);

  useEffect(() => {
    // Update cohort data when a new cohort is selected
    const loadData = async () => {
      if (data !== undefined) {
        await dataService.loadCohortData(data);
      } else {
        dataService.createNewCohort();
      }
      setCohortName(dataService.cohort_name);
    };
    loadData();
  }, [data]);

  useEffect(() => {
    // Update cohort name when data service changes
    const updateCohortName = () => {
      if (dataService.cohort_data?.name) {
        setCohortName(dataService._cohort_name);
      }
    };

    updateCohortName();
    dataService.addListener(updateCohortName);

    return () => {
      dataService.removeListener(updateCohortName);
    };
  }, [dataService]);

  const renderTitle = () => {
    return (
      <div className={styles.cohortNameContainer}>
        <EditableTextField
          value={cohortName}
          placeholder="Name your cohort..."
          className={styles.cohortNameInput}
          onChange={newValue => {
            setCohortName(newValue);
            dataService.cohort_name = newValue;
          }}
          onSaveChanges={async () => {
            await dataService.saveChangesToCohort();
        }}
        />
      </div>
    );
  }

  return (
    <div className={styles.cohortTableContainer}>
      {renderTitle()}
      <AppNavigationTabBar />
      <IssuesDisplayControl />
      <div className={styles.bottomSection}>
        <CohortDefinitionView data={data} />
      </div>
    </div>
  );
};
