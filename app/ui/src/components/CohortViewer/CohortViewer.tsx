import { FC, useState, useRef, useEffect } from 'react';
import styles from './CohortViewer.module.css';
import { CohortViewerHeader } from './CohortViewerHeader';
import { CohortDataService } from './CohortDataService/CohortDataService';
import { TableData } from './tableTypes';
import { CohortTable } from './CohortTable/CohortTable';
import { CohortInfo } from './CohortInfo/CohortInfo';
import { CohortDefinitionView } from './CohortDefinitionView/CohortDefinitionView';

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
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [cohortName, setCohortName] = useState(data ?? '');
  const gridRef = useRef<any>(null);
  const [dataService] = useState(() => CohortDataService.getInstance());
  const [currentView, setCurrentView] = useState<CohortViewType>(CohortViewType.CohortDefinition);

  useEffect(() => {
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

  const navigateTo = (viewType: CohortViewType) => {
    setCurrentView(viewType);
  };

  const renderView = () => {
    switch (currentView) {
      case CohortViewType.CohortDefinition:
        return <CohortDefinitionView />;
      case CohortViewType.Info:
        return <CohortInfo />;
      case CohortViewType.Report:
        return <div>Report View</div>;
      default:
        return null;
    }
  };

  return (
    <div className={styles.cohortTableContainer}>
      <CohortViewerHeader
        onCohortNameChange={setCohortName}
        onSaveChanges={async () => {
          await dataService.saveChangesToCohort();
        }}
        navigateTo={navigateTo}
      />
      <div className={styles.bottomSection}>{renderView()}</div>
    </div>
  );
};
