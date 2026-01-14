import { FC, useState, useRef, useEffect } from 'react';
import styles from './PhenotypeComponents.module.css';
import { PhenotypeDataService } from '../PhenotypeDataService';
import { CohortTable } from '../../../CohortViewer/CohortTable/CohortTable';
import typeStyles from '../../../../styles/study_types.module.css';

interface PhenotypeComponentsProps {
  data?: string;
  onTableHeightChange?: (height: number) => void;
}

export const PhenotypeComponents: FC<PhenotypeComponentsProps> = ({ data, onTableHeightChange }) => {
  const gridRef = useRef<any>(null);
  const [dataService] = useState(() => PhenotypeDataService.getInstance());
  const [tableData, setTableData] = useState(dataService.componentPhenotypeTableData);

  const refreshGrid = () => {
    // Grid will refresh automatically via React when tableData changes
    // No need to manually call setGridOption which causes re-renders
  };

  useEffect(() => {
    const listener = (refreshPhenotypeGrid: boolean = false) => {
      // Update the state to trigger re-render
      setTableData(dataService.componentPhenotypeTableData);

      if (refreshPhenotypeGrid) {
        refreshGrid();
      }
    };
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

  // Calculate and emit total table height when table data changes
  useEffect(() => {
    if (onTableHeightChange && tableData.rows) {
      const headerHeight = 0; // No header based on headerHeight prop
      const totalRowsHeight = tableData.rows.reduce((total, row) => {
        return total + calculateRowHeight({ data: row, api: { getColumnDef: () => ({ width: 200 }) } });
      }, 0);
      const totalHeight = headerHeight + totalRowsHeight + 65; // Add some padding
      onTableHeightChange(totalHeight);
    }
  }, [tableData, onTableHeightChange]);

  const onCellValueChanged = async (event: any) => {
    if (event.newValue !== event.oldValue) {
      // Component phenotypes are stored in the cohort data, not phenotype params
      // Use CohortDataService to handle the change
      dataService.cohortDataService.onCellValueChanged(event);
      dataService.saveChangesToPhenotype(false);
    }
  };

  const onRowDragEnd = async (newRowData: any[]) => {
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
      borderColor: 'transparent',
      accentColor: 'transparent',
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
    
  const calculateRowHeight = (params: any) => {
    let current_max_height = 20;
    const minHeight = 20; 

    const nameCol = params.api.getColumnDef('name');
    console.log("nameCol", nameCol, params.data?.name);
    if (!nameCol || !params.data?.name) return minHeight; // Increased minimum height
    const nameWidth = 200;
    const nameCharPerLine = Math.floor(nameWidth / 8);
    const nameLines = Math.ceil(params.data?.name.length / nameCharPerLine);
    const nameHeight = nameLines * 15 + 8; // 14px per line + padding
    current_max_height = Math.max(current_max_height, nameHeight);
    return current_max_height;
  
  }

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
      <div className={`${styles.tableBox} ${typeStyles[`${data.type}_border_color`]}`}>
        <CohortTable
          data={tableData}
          onCellValueChanged={onCellValueChanged}
          onRowDragEnd={onRowDragEnd}
          ref={gridRef}
          currentlyViewing={'components'}
          tableTheme={default_theme}
          hideHorizontalScrollbar={true}
          customGetRowHeight={calculateRowHeight}
          headerHeight={0}
        />
      </div>
    </div>
  );
};
