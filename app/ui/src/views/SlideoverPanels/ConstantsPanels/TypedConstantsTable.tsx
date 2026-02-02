import React, { useEffect, useRef } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { ColDef } from '@ag-grid-community/core';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import { ConstantsCellRenderer } from '../ConstantsPanel/ConstantsCellRenderer';
import { ConstantsCellEditorSelector } from '../ConstantsPanel/ConstantsCellEditorSelector';
import styles from './ConstantsPanels.module.css';

const NAME_VALUE_COLUMNS: ColDef[] = [
  {
    field: 'name',
    headerName: 'Name',
    width: 200,
    editable: true,
  },
  {
    field: 'value',
    headerName: 'Value',
    editable: true,
    minWidth: 0,
    flex: 1,
    cellEditorPopup: true,
    cellRenderer: ConstantsCellRenderer,
    cellEditor: ConstantsCellEditorSelector,
    valueParser: (params) => params.newValue,
    valueSetter: (params) => {
      params.data.value = params.newValue;
      return true;
    },
  },
];

interface TypedConstantsTableProps {
  constantType: string;
}

export const TypedConstantsTable: React.FC<TypedConstantsTableProps> = ({ constantType }) => {
  const dataService = useRef(CohortDataService.getInstance()).current;
  const gridRef = useRef<any>(null);

  const refreshGrid = () => {
    if (gridRef.current?.api) {
      const api = gridRef.current.api;
      const firstRow = api.getFirstDisplayedRow();
      const lastRow = api.getLastDisplayedRow();
      const { rows } = dataService.constants_service.getRowsForType(constantType);
      api.setGridOption('rowData', rows);
      requestAnimationFrame(() => {
        api.ensureIndexVisible(firstRow, 'top');
        api.ensureIndexVisible(lastRow, 'bottom');
      });
    }
  };

  useEffect(() => {
    const listener = () => refreshGrid();
    dataService.addListener(listener);
    return () => dataService.removeListener(listener);
  }, [dataService, constantType]);

  const onCellValueChanged = (event: any) => {
    if (event.newValue === event.oldValue) return;
    const field = event.colDef.field as 'name' | 'value';
    const rowIndex = event.rowIndex;
    dataService.constants_service.valueChangedForType(constantType, rowIndex, field, event.newValue);
  };

  const { rows } = dataService.constants_service.getRowsForType(constantType);

  return (
    <div className={styles.container}>
      <div className={styles.bottomSection}>
        <div className={styles.tableBox}>
          <div className={styles.gridContainer}>
            <AgGridReact
              rowData={rows}
              columnDefs={NAME_VALUE_COLUMNS}
              ref={gridRef}
              theme={dataService.constants_service.getTheme()}
              onCellValueChanged={onCellValueChanged}
              animateRows={true}
              headerHeight={0}
              domLayout="autoHeight"
              defaultColDef={{
                flex: 1,
                minWidth: 100,
                resizable: true,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
