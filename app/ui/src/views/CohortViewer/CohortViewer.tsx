import { FC, useState, useRef, useEffect } from 'react';
import styles from './CohortViewer.module.css';
import { CohortDataService } from './CohortDataService/CohortDataService';

import { IssuesDisplayControl } from './CohortIssuesDisplay/IssuesDisplayControl';
import { EditableTextField } from '../../components/EditableTextField/EditableTextField';
import { AppNavigationTabBar } from './AppNavigationTabBar';
import { CohortTable } from './CohortTable/CohortTable';
import { Tabs } from '../../components/ButtonsAndTabs/Tabs/Tabs';

enum CohortDefinitionViewType {
  Cohort = 'cohort',
  Baseline = 'baseline',
  Outcomes = 'outcomes',
  All='all',
}

const sectionDisplayNames = {
  [CohortDefinitionViewType.Cohort]: 'Cohort definition',
  [CohortDefinitionViewType.Baseline]: 'Baseline characteristics',
  [CohortDefinitionViewType.Outcomes]: 'Outcomes',
  [CohortDefinitionViewType.All]: 'All phenotypes',
}

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
  const [currentView, setCurrentView] = useState<CohortDefinitionViewType>(
    CohortDefinitionViewType.Cohort
  );

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



    const refreshGrid = () => {
      console.log("REFERSHING GRID")
      if (gridRef.current?.api) {
        console.log("IN REFRESH GRID", dataService.table_data['columns'])
        const api = gridRef.current.api;
        // Store current scroll position
        // const horizontalScroll = api.getHorizontalPixelRange();
        const firstRow = api.getFirstDisplayedRow();
        const lastRow = api.getLastDisplayedRow();
  
        // Update grid data
        api.setGridOption('rowData', dataService.table_data['rows']);
        api.setGridOption('columnDefs', dataService.table_data['columns']); // Changed from 'columns' to 'columnDefs'

        // Restore scroll position after data update
        requestAnimationFrame(() => {
          // api.ensureIndexVisible(firstRow, 'top');
          api.ensureIndexVisible(lastRow, 'bottom');
  
          // api.horizontalScroll().setScrollPosition({ left: horizontalScroll.left });
        });
      }
    };
  
    useEffect(() => {
      // Add listener for data service updates
      const listener = () => {
        refreshGrid();
        console.log("REFRESHING GRID")
      };
      dataService.addListener(listener);
  
      // Initial data load
      refreshGrid();
  
      return () => {
        dataService.removeListener(listener);
      };
    }, [dataService]);
  
    useEffect(() => {
      if (currentView === CohortDefinitionViewType.Cohort) {
        refreshGrid();
      }
    }, [currentView]);
  
    const onCellValueChanged = async (event: any) => {
      console.log('CELL VALUE CHANGED', event.newValue, event.oldValue);
      if (event.newValue !== event.oldValue) {
        dataService.onCellValueChanged(event);
        // setTableData(dataService.table_data);
      }
  
      if (['description', 'class_name'].includes(event.colDef.field)) {
        refreshGrid();
      }
    };
  
    const tabs = Object.values(CohortDefinitionViewType).map(value => {
      return sectionDisplayNames[value]
    });
  
    const onTabChange = (index: number) => {
      const viewTypes = Object.values(CohortDefinitionViewType);
      const newView = viewTypes[index];
  
      // First update the data filter
      switch (newView) {
        case CohortDefinitionViewType.Cohort:
          dataService.filterType(['entry', 'inclusion', 'exclusion']);
          break;
        case CohortDefinitionViewType.Baseline:
          dataService.filterType('baseline');
          break;
        case CohortDefinitionViewType.Outcomes:
          dataService.filterType('outcome');
          break;
        case CohortDefinitionViewType.All:
          dataService.filterType(['entry', 'inclusion', 'exclusion', 'baseline', 'outcome', 'component']);
          break;
      }
  
      // Then update the view and refresh grid
      setCurrentView(newView);
      refreshGrid();
    };
  
  const determineTabIndex = (): number => {
    return Object.values(CohortDefinitionViewType).indexOf(currentView);
  };


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

  const renderSectionTabs = () => {
      return (
        <div className={styles.sectionTabsContainer}>
          <Tabs
            width={400}
            height={25}
            tabs={tabs}
            onTabChange={onTabChange}
            active_tab_index={determineTabIndex()}
          />
        </div>
      );
  }

  const renderTable = () => {
    return (
      <CohortTable
        data={dataService.table_data}
        currentlyViewing={currentView}
        onCellValueChanged={onCellValueChanged}
        ref={gridRef}
      />
    );
  }

  return (
    <div className={styles.cohortTableContainer}>
      <div className={styles.topSection}>
        {renderTitle()}
        <AppNavigationTabBar />
        <IssuesDisplayControl />
        {renderSectionTabs()}
      </div>
      <div className={styles.bottomSection}>
        {renderTable()}
      </div>
    </div>
  );
};
