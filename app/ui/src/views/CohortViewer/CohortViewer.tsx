import { FC, useState, useRef, useEffect } from 'react';
import styles from './CohortViewer.module.css';
import { CohortDataService } from './CohortDataService/CohortDataService';

import { IssuesDisplayControl } from './CohortIssuesDisplay/IssuesDisplayControl';
import { EditableTextField } from '../../components/EditableTextField/EditableTextField';
import { RighPanelNavigationTabBar } from './RighPanelNavigationTabBar';
import { PopoverHeader } from '../../components/PopoverHeader/PopoverHeader';
import { CohortTable } from './CohortTable/CohortTable';
import { Tabs } from '../../components/ButtonsAndTabs/Tabs/Tabs';
import { CustomizableDropdownButton } from '@/components/ButtonsAndTabs/ButtonsBar/CustomizableDropdownButton';
import { TypeSelectorEditor } from './CohortTable/CellEditors/typeSelectorEditor/TypeSelectorEditor';
import { SmartBreadcrumbs } from '../../components/SmartBreadcrumbs';
import { TwoPanelCohortViewerService } from './TwoPanelCohortViewer/TwoPanelCohortViewer';
import { MainViewService, ViewType } from '../MainView/MainView';
import { PhenExNavBar } from '../../components/PhenExNavBar/PhenExNavBar';
import { Portal } from '../../components/Portal/Portal';

enum CohortDefinitionViewType {
  Cohort = 'cohort',
  Baseline = 'baseline',
  Outcomes = 'outcomes',
  All = 'all',
}

const sectionDisplayNames = {
  [CohortDefinitionViewType.Cohort]: 'Cohort definition',
  [CohortDefinitionViewType.Baseline]: 'Baseline characteristics',
  [CohortDefinitionViewType.Outcomes]: 'Outcomes',
  [CohortDefinitionViewType.All]: 'All phenotypes',
};

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
  const [cohortName, setCohortName] = useState('');
  const [studyName, setStudyName] = useState('');
  const gridRef = useRef<any>(null);
  const [dataService] = useState(() => CohortDataService.getInstance());
  const [currentView, setCurrentView] = useState<CohortDefinitionViewType>(
    CohortDefinitionViewType.Cohort
  );
  const [showIssuesPopover, setShowIssuesPopover] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const customizableDropdownButtonRef = useRef<{ closeDropdown: () => void }>({} as { closeDropdown: () => void });
  const navBarDragHandleRef = useRef<HTMLDivElement>(null);
  const [scrollPercentage, setScrollPercentage] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    // Update cohort data when a new cohort is selected
    const loadData = () => {
      console.log("loading cohort data")
      if (data !== undefined) {
        dataService.loadCohortData(data);
        console.log("finished loading cohort data", dataService.cohort_data)
      } else {
        dataService.createNewCohort();
      }
      setCohortName(dataService.cohort_name);
      setStudyName(dataService.getStudyNameForCohort());
    };
    loadData();
  }, [data]);

  useEffect(() => {
    // Listen to right panel state changes
    const cohortViewerService = TwoPanelCohortViewerService.getInstance();
    
    const handleRightPanelChange = (viewType: any, extraData: any, isCollapsed: boolean) => {
      // Right panel is open if it's not collapsed
      setIsRightPanelOpen(!isCollapsed);
    };
    
    cohortViewerService.addListener(handleRightPanelChange);
    
    // Check initial state - assume collapsed initially
    setIsRightPanelOpen(false);
    
    return () => {
      cohortViewerService.removeListener(handleRightPanelChange);
    };
  }, []);

  useEffect(() => {
    // Update cohort name and study name when data service changes
    const updateCohortData = () => {
      if (dataService.cohort_data?.name) {
        setCohortName(dataService._cohort_name);
        setStudyName(dataService.getStudyNameForCohort());
      }
    };

    updateCohortData();
    dataService.addListener(updateCohortData);

    return () => {
      dataService.removeListener(updateCohortData);
    };
  }, [dataService]);

  const refreshGrid = () => {
    // With getRowId callback in CohortTable, AG Grid automatically maintains scroll position
    // We just need to update the grid data
    if (gridRef.current?.api && !gridRef.current.api.isDestroyed()) {
      const api = gridRef.current.api;
      
      console.log(
        'Setting grid rowData to:',
        dataService.table_data['rows'].map(r => ({
          id: r.id,
          type: r.type,
          name: r.name,
          index: r.index,
        }))
      );
      
      // Update grid data - AG Grid will maintain scroll position automatically with getRowId
      api.setGridOption('rowData', dataService.table_data['rows']);
      api.setGridOption('columnDefs', dataService.table_data['columns']);
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

  const onCellValueChanged = async (event: any, selectedRows?: any[]) => {
    if (event.newValue !== event.oldValue) {
      dataService.onCellValueChanged(event, selectedRows);
      // setTableData(dataService.table_data);
    }

    if (['description', 'class_name'].includes(event.colDef.field)) {
      refreshGrid();
    }
  };

  const onRowDragEnd = async (newRowData: any[]) => {
    console.log('=== CohortViewer onRowDragEnd START ===');
    console.log(
      'Received newRowData:',
      newRowData.map(r => ({ id: r.id, type: r.type, name: r.name, index: r.index }))
    );
    console.log(
      'Current table data before update:',
      dataService.table_data.rows.map(r => ({
        id: r.id,
        type: r.type,
        name: r.name,
        index: r.index,
      }))
    );

    // Update the data service with the new row order
    await dataService.updateRowOrder(newRowData);

    console.log(
      'After updateRowOrder, table data:',
      dataService.table_data.rows.map(r => ({
        id: r.id,
        type: r.type,
        name: r.name,
        index: r.index,
      }))
    );

    // Refresh the grid to reflect the changes
    refreshGrid();
    console.log('=== CohortViewer onRowDragEnd END ===');
  };
  const tabs = Object.values(CohortDefinitionViewType).map(value => {
    return sectionDisplayNames[value];
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
        dataService.filterType([
          'entry',
          'inclusion',
          'exclusion',
          'baseline',
          'outcome',
          'component',
        ]);
        break;
    }

    // Then update the view and refresh grid
    setCurrentView(newView);
    refreshGrid();
  };

  const determineTabIndex = (): number => {
    return Object.values(CohortDefinitionViewType).indexOf(currentView);
  };

  // FOR ADD NEW PHENOTYPE DROPDOWN
  const renderAddNewPhenotypeDropdown = () => {
    return (
      <div className={styles.addNewPhenotypeDropdown}>
        <PopoverHeader
          onClick={clickedOnHeader}
          title={'Add a new phenotype'}
          className={styles.popoverheader}
        />
        <TypeSelectorEditor onValueChange={handleAddNewPhenotypeDropdownSelection} />
      </div>
    );
  };

  // FOR ADD NEW PHENOTYPE DROPDOWN
  const handleAddNewPhenotypeDropdownSelection = (type: string) => {
    dataService.addPhenotype(type);
    // Switch to the appropriate section tab based on phenotype type
      if (type === 'baseline') {
      onTabChange(1); // Baseline characteristics tab
    } else if (type === 'outcome') {
      onTabChange(2); // Outcomes tab
    } else if (['entry', 'inclusion', 'exclusion'].includes(type)) {
      onTabChange(0); // Cohort definition tab
    }
    // setIsOpen(false);
  };

  // FOR ADD NEW PHENOTYPE DROPDOWN
  const clickedOnHeader = () => {
    customizableDropdownButtonRef.current?.closeDropdown();
  };

  // FOR ADD NEW PHENOTYPE DROPDOWN
  const renderAddNewPhenotypeButton = () => {
    return (
        <CustomizableDropdownButton
          key={"new phenotype"}
          label={"Add a new phenotype"}
          content={renderAddNewPhenotypeDropdown()}
          ref={customizableDropdownButtonRef}
          buttonClassName={styles.addPhenotypeButtonLabel}
          outline={true}
        />
    );
  };

  const renderSectionTabs = () => {
    return (
      <div className={styles.sectionTabsContainer}>
        <Tabs
          width={400}
          height={25}
          tabs={tabs}
          onTabChange={onTabChange}
          active_tab_index={determineTabIndex()}
          classNameTabs = {styles.classNameSectionTabs}
          classNameTabsContainer={styles.classNameTabsContainer}
        />
        <div className={styles.addPhenotypeButton}>
          {renderAddNewPhenotypeButton()}
        </div>
      </div>
    );
  };

  const renderTable = () => {
    return (
      <CohortTable
        data={dataService.table_data}
        currentlyViewing={currentView}
        onCellValueChanged={onCellValueChanged}
        onRowDragEnd={onRowDragEnd}
        hideScrollbars={showIssuesPopover}
        hideVerticalScrollbar={isRightPanelOpen}
        ref={gridRef}
      />
    );
  };

  const navigateToStudyViewer = () => {
      const mainViewService = MainViewService.getInstance();
      mainViewService.navigateTo({ viewType: ViewType.StudyViewer, data: dataService._study_data });
  };

  const renderBreadcrumbs = () => {
    const breadcrumbItems = [
      {
        displayName: studyName || 'Study',
        onClick: navigateToStudyViewer,
      },
      {
        displayName: cohortName || 'Unnamed Cohort',
        onClick: () => {},
      },
    ];

    const handleEditLastItem = async (newValue: string) => {
      setCohortName(newValue);
      dataService.cohort_name = newValue;
      await dataService.saveChangesToCohort();
    };

    return <SmartBreadcrumbs items={breadcrumbItems} onEditLastItem={handleEditLastItem} classNameSmartBreadcrumbsContainer={styles.breadcrumbsContainer} classNameBreadcrumbItem={styles.breadcrumbItem} classNameBreadcrumbLastItem={styles.breadcrumbLastItem}/>;
  };

  const handleViewNavigationArrowClicked = (direction: 'left' | 'right') => {
    if (gridRef.current?.scrollByColumn) {
      gridRef.current.scrollByColumn(direction);
      // Update scroll state after scrolling
      updateScrollState();
    }
  };

  const handleViewNavigationScroll = (percentage: number) => {
    if (gridRef.current?.scrollToPercentage) {
      gridRef.current.scrollToPercentage(percentage);
      setScrollPercentage(percentage);
      updateScrollState();
    }
  };

  const handleViewNavigationVisibilityClicked = () => {
    console.log('ViewNavigation visibility clicked');
  };

  const updateScrollState = () => {
    if (gridRef.current?.getScrollPercentage) {
      const percentage = gridRef.current.getScrollPercentage();
      setScrollPercentage(percentage);
      setCanScrollLeft(percentage > 0);
      setCanScrollRight(percentage < 100);
    }
  };

  // Listen to grid scroll events to update navbar
  useEffect(() => {
    const handleScroll = () => {
      updateScrollState();
    };

    // Find the grid viewport and attach scroll listener
    const gridElement = gridRef.current?.eGridDiv;
    if (gridElement) {
      const viewport = gridElement.querySelector('.ag-center-cols-viewport');
      if (viewport) {
        viewport.addEventListener('scroll', handleScroll);
        // Initial state update
        updateScrollState();
        
        return () => {
          viewport.removeEventListener('scroll', handleScroll);
        };
      }
    }
  }, [dataService.table_data]);
  
  return (
    <div className={styles.cohortTableContainer}>
      <div className={styles.topSection}>
        {renderBreadcrumbs()}
        {/* <RighPanelNavigationTabBar title="Cohort Navigation" onSectionTabChange={onTabChange} />
        {renderSectionTabs()} */}
      </div>
      <div className={styles.bottomSection}>
        {renderTable()}
        <div className={styles.bottomGradient} />
      </div>
        <IssuesDisplayControl 
          showPopover={showIssuesPopover} 
          setShowPopover={setShowIssuesPopover} 
        />
        <Portal>
          <div style={{
            position: 'fixed',
            bottom: '0px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000
          }}>
            <PhenExNavBar
              onSectionTabChange={onTabChange}
              dragHandleRef={navBarDragHandleRef}
              scrollPercentage={scrollPercentage}
              canScrollLeft={canScrollLeft}
              canScrollRight={canScrollRight}
              onViewNavigationArrowClicked={handleViewNavigationArrowClicked}
              onViewNavigationScroll={handleViewNavigationScroll}
              onViewNavigationVisibilityClicked={handleViewNavigationVisibilityClicked}
            />
          </div>
        </Portal>
    </div>
  );
};
