import { FC, useState, useRef, useEffect } from 'react';
import styles from './PhenotypeComponents.module.css';
import { PhenotypeDataService } from '../PhenotypeDataService';
import { CohortTable } from '../../../CohortViewer/CohortTable/CohortTable';
import typeStyles from '../../../../styles/study_types.module.css';

interface PhenotypeComponentsProps {
  data?: string;
}

export const PhenotypeComponents: FC<PhenotypeComponentsProps> = ({ data }) => {
  const gridRef = useRef<any>(null);
  const [dataService] = useState(() => PhenotypeDataService.getInstance());
  const [tableData, setTableData] = useState(dataService.componentPhenotypeTableData);

  const refreshGrid = () => {
    // Grid will refresh automatically via React when tableData changes
    // No need to manually call setGridOption which causes re-renders
    console.log('Grid refresh requested - will happen via React re-render');
  };

  useEffect(() => {
    const listener = (refreshPhenotypeGrid: boolean = false) => {
      console.log(
        'REFRESHING GRID ATTMPET',
        refreshPhenotypeGrid,
        dataService.componentPhenotypeTableData
      );
      // Update the state to trigger re-render
      setTableData(dataService.componentPhenotypeTableData);

      if (refreshPhenotypeGrid) {
        refreshGrid();
      }
    };
    console.log('IA M ADDING A COMPONENT PHENOTYPE LISTNERE');
    dataService.addComponentPhenotypeListener(listener);

    return () => {
      dataService.removeListener(listener);
    };
  }, []);

  useEffect(() => {
    const listener = (refreshPhenotypeGrid: boolean = false) => {
      if (refreshPhenotypeGrid) {
        refreshGrid();
      }
    };
    dataService.addListener(listener);

    if (data) {
      console.log('SETTING DATA', data);
      dataService.setData(data);
    }

    return () => {
      dataService.removeListener(listener);
    };
  }, [data]);

  // Update table data when the phenotype data changes
  useEffect(() => {
    setTableData(dataService.componentPhenotypeTableData);
  }, [data]);

  const onCellValueChanged = async (event: any) => {
    if (event.newValue !== event.oldValue) {
      // Component phenotypes are stored in the cohort data, not phenotype params
      // Use CohortDataService to handle the change
      dataService.cohortDataService.onCellValueChanged(event);
      dataService.saveChangesToPhenotype(false);
    }
  };

  const onRowDragEnd = async (newRowData: any[]) => {
    console.log('=== PhenotypeComponents onRowDragEnd ===');
    // Component phenotypes are stored in cohort data
    // Use specialized method for reordering components within a parent
    const parentId = dataService.currentPhenotype?.id;
    if (parentId) {
      await dataService.cohortDataService.updateComponentOrder(parentId, newRowData);
    }
    // No need to manually refresh - cohort data change listener will handle it
  };

  const clickedOnAddButton = (e: React.MouseEvent) => {
    dataService.addNewComponentPhenotype();
  };

  const default_theme = {
      accentColor: '#BBB',
      borderColor: 'var(--line-color-grid)',
      browserColorScheme: 'light',
      columnBorder: false,
      headerFontSize: 16,
      // headerFontWeight: 'bold',
      headerRowBorder: true,
      cellHorizontalPadding: 10,
      headerBackgroundColor: 'transparent',
      rowBorder: false,
      spacing: 8,
      wrapperBorder: false,
      backgroundColor: 'transparent',
    };

  return (
    <div className={styles.phenotypeContainer}>
      <div className={styles.header}>
        <button
          className={`${styles.addButton} ${typeStyles[`${data.type}_color_text_and_border_on_hover`]}`}
          onClick={clickedOnAddButton}
        >
          Add Component
        </button>
      </div>
      <div className={styles.tableBox}>
        <CohortTable
          data={tableData}
          onCellValueChanged={onCellValueChanged}
          onRowDragEnd={onRowDragEnd}
          ref={gridRef}
          currentlyViewing={'components'}
          tableTheme={default_theme}
          hideHorizontalScrollbar={true}

        />
      </div>
    </div>
  );
};
