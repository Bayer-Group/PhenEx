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
  const [cohortName, setCohortName] = useState(data ?? '');
  const gridRef = useRef<any>(null);
  const [dataService] = useState(() => CohortDataService.getInstance());
  const [currentView, setCurrentView] = useState<CohortDefinitionViewType>(
    CohortDefinitionViewType.Cohort
  );
  const [showIssuesPopover, setShowIssuesPopover] = useState(false);
  const customizableDropdownButtonRef = useRef<{ closeDropdown: () => void }>({} as { closeDropdown: () => void });

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

    if (gridRef.current?.api && !gridRef.current.api.isDestroyed()) {
      const api = gridRef.current.api;
      // Store current scroll position
      // const horizontalScroll = api.getHorizontalPixelRange();
      const firstRow = api.getFirstDisplayedRowIndex();
      const lastRow = api.getLastDisplayedRowIndex();

      console.log(
        'Setting grid rowData to:',
        dataService.table_data['rows'].map(r => ({
          id: r.id,
          type: r.type,
          name: r.name,
          index: r.index,
        }))
      );
      // Update grid data
      api.setGridOption('rowData', dataService.table_data['rows']);
      api.setGridOption('columnDefs', dataService.table_data['columns']); // Changed from 'columns' to 'columnDefs'

      // Restore scroll position after data update
      requestAnimationFrame(() => {
        // Check if grid is still alive before calling API methods
        if (gridRef.current?.api && !gridRef.current.api.isDestroyed()) {
          // Only ensure visible if we have valid row indices
          if (lastRow >= 0) {
            gridRef.current.api.ensureIndexVisible(lastRow, 'bottom');
          }
        }
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

  const renderTitle = () => {
    return (
      <div className={styles.cohortNameContainer}>
        <EditableTextField
          value={cohortName}
          placeholder="Name your cohort..."
          classNameInput={styles.cohortNameInput}
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
        ref={gridRef}
      />
    );
  };

  return (
    <div className={styles.cohortTableContainer}>
      <div className={styles.topSection}>
        {renderTitle()}
        <RighPanelNavigationTabBar title="Cohort Navigation" onSectionTabChange={onTabChange} />
        <IssuesDisplayControl 
          showPopover={showIssuesPopover} 
          setShowPopover={setShowIssuesPopover} 
        />
        {renderSectionTabs()}
      </div>
      <div className={styles.bottomSection}>{renderTable()}</div>
    </div>
  );
};
