import { FC, useState, useRef, useEffect } from 'react';
import styles from './CohortDefinitionView.module.css';
import { CohortDataService } from '../CohortDataService/CohortDataService';
import { CohortTable } from '../CohortTable/CohortTable';
import { Tabs } from '../../../components/Tabs/Tabs';
import { AppNavigationTabBar } from './AppNavigationTabBar';

interface CohortDefinitionViewProps {
  data?: string;
  onAddPhenotype?: () => void;
}

enum CohortDefinitionViewType {
  // All='all',
  Cohort = 'cohort',
  Baseline = 'baseline',
  Outcomes = 'outcomes',
}

export const CohortDefinitionView: FC<CohortDefinitionViewProps> = ({ data }) => {
  const gridRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dataService] = useState(() => CohortDataService.getInstance());
  const [currentView, setCurrentView] = useState<CohortDefinitionViewType>(
    CohortDefinitionViewType.Cohort
  );
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setIsNarrow(entry.contentRect.width < 500);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const refreshGrid = () => {
    console.log('REFRESHING GRID before', gridRef.current?.api);
    if (currentView === CohortDefinitionViewType.Cohort && gridRef.current?.api) {
      console.log('REFRESHING GRID after', gridRef.current?.api);
      const api = gridRef.current.api;
      // Store current scroll position
      // const horizontalScroll = api.getHorizontalPixelRange();
      const firstRow = api.getFirstDisplayedRow();
      const lastRow = api.getLastDisplayedRow();

      // Update grid data
      api.setGridOption('rowData', dataService.table_data['rows']);

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
    return value.charAt(0).toUpperCase() + value.slice(1);
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
    }

    // Then update the view and refresh grid
    setCurrentView(newView);
    refreshGrid();
  };

  const determineTabIndex = (): number => {
    return currentView === CohortDefinitionViewType.Cohort
      ? 0
      : currentView === CohortDefinitionViewType.Baseline
        ? 1
        : currentView === CohortDefinitionViewType.Outcomes
          ? 2
          : 0; // Default to the first tab if the currentView is not recognized or undefined
  };

  console.log("INSIDE COHORT DEIFNITON FIEW", currentView)
  return (
    <div ref={containerRef} className={styles.cohortTableContainer}>
      <div className={styles.topSection}>
        <div className={styles.controlsContainer}>
          <Tabs
            width={400}
            height={25}
            tabs={tabs}
            onTabChange={onTabChange}
            active_tab_index={determineTabIndex()}
          />
        </div>
      </div>
      <div className={styles.bottomSection}>
        <div className={styles.tableBox}>
          <CohortTable
            data={dataService.table_data}
            currentlyViewing={currentView}
            onCellValueChanged={onCellValueChanged}
            ref={gridRef}
          />
        </div>
      </div>
    </div>
  );
};
