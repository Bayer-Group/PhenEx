import { FC, useState, useRef, useEffect } from 'react';
import styles from './CohortViewer.module.css';
import { CohortViewerHeader } from './CohortViewerHeader';
import { CohortDataService } from './CohortDataService';
import { TableData } from './tableTypes';
import { CohortTable } from './CohortTable/CohortTable';
import { CohortInfo } from './CohortInfo/CohortInfo';

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
  const [cohortInfoPanelWidth] = useState(300);
  const [cohortName, setCohortName] = useState(data ?? '');
  const gridRef = useRef<any>(null);
  const [dataService] = useState(() => CohortDataService.getInstance());
  const [currentView, setCurrentView] = useState<CohortViewType>(CohortViewType.CohortDefinition);

  const refreshGrid = () => {
    console.log('REFRESIGHING GRID', gridRef.current?.api!);
    if (currentView === CohortViewType.CohortDefinition && gridRef.current?.api) {
      console.log('and actually refreshing');
      gridRef.current?.api!.setGridOption('rowData', dataService.table_data['rows']);
    } else {
      console.log('not there');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (data !== undefined) {
        await dataService.loadCohortData(data);
      } else {
        dataService.createNewCohort();
      }
      setTableData(dataService.table_data); // For some reason this is necessary for initial render of data TODO figure out how to call render without this unused variable
      setCohortName(dataService.cohort_name);
      refreshGrid();
    };
    loadData();
  }, [data]);

  const navigateTo = (viewType: CohortViewType) => {
    setCurrentView(viewType);
  };

  useEffect(() => {
    // Subscribe to data service changes
    dataService.addListener(refreshGrid);
    // Cleanup subscription when component unmounts
    return () => {
      dataService.removeListener(refreshGrid);
    };
  }, [dataService]); // Only run once when dataService is initialized

  const renderView = () => {
    switch (currentView) {
      case CohortViewType.CohortDefinition:
        return (
          <CohortTable
            data={dataService.table_data}
            onCellValueChanged={onCellValueChanged}
            ref={gridRef}
          />
        );
      case CohortViewType.Characteristics:
        return <div>Characteristics View</div>;
      case CohortViewType.Info:
        return <CohortInfo />;
      case CohortViewType.Report:
        return <div>Report View</div>;
      default:
        return null;
    }
  };

  const onCellValueChanged = async (event: any) => {
    if (event.newValue !== event.oldValue) {
      dataService.onCellValueChanged(event);
    }
  };

  const clickedAddPhenotype = async (type: string) => {
    if (currentView != CohortViewType.CohortDefinition) {
      navigateTo(CohortViewType.CohortDefinition);
    }
    dataService.addPhenotype(type);
    if (onAddPhenotype) {
      onAddPhenotype();
    }
  };

  const executeCohort = async () => {
    await dataService.executeCohort();
  };

  return (
    <div className={styles.cohortTableContainer}>
      <CohortViewerHeader
        cohortName={cohortName}
        dataService={dataService}
        onCohortNameChange={setCohortName}
        onSaveChanges={async () => {
          await dataService.saveChangesToCohort();
        }}
        navigateTo={navigateTo}
        onAddPhenotype={clickedAddPhenotype}
        onExecute = {executeCohort}
      />
      <div className={styles.bottomSection}>
        <div className={styles.rightPanel}>{renderView()}</div>
      </div>
    </div>
  );
};
