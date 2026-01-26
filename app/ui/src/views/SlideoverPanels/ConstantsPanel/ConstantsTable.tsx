import React, { useEffect, useRef } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import styles from './ConstantsPanel.module.css'
export const ConstantsTable: React.FC = () => {
  const dataService = useRef(CohortDataService.getInstance()).current;
  const gridRef = useRef<any>(null);

  const refreshGrid = () => {
    if (gridRef.current?.api) {
      const api = gridRef.current.api;
      const firstRow = api.getFirstDisplayedRow();
      const lastRow = api.getLastDisplayedRow();

      api.setGridOption('rowData', dataService.constants_service.tableData.rows);

      requestAnimationFrame(() => {
        api.ensureIndexVisible(firstRow, 'top');
        api.ensureIndexVisible(lastRow, 'bottom');
      });
    }
  };

  const addConstant = () => {
    console.log('adding constant');
    dataService.constants_service.addConstant();
  };


  useEffect(() => {
    const listener = () => refreshGrid();
    dataService.addListener(listener);

    return () => {
      dataService.removeListener(listener);
    };
  }, [dataService]);

  const onCellValueChanged = async (event: any) => {
    console.log('onCellValueChanged event:', {
      field: event.colDef.field,
      rowIndex: event.rowIndex,
      oldValue: event.oldValue,
      newValue: event.newValue,
      newValueType: typeof event.newValue,
      data: event.data
    });
    
    if (event.newValue !== event.oldValue) {
      const field = event.colDef.field;
      const rowIndex = event.rowIndex;
      dataService.constants_service.valueChanged(rowIndex, field, event.newValue);
    }
  };

  return (
    console.log('CONSTANTS DATA', dataService.constants_service.tableData),
    (
      <div style={{ width: '100%', height: '100%' }}>
      <div className={styles.controls}>
        <button onClick={addConstant} className={styles.addButton}>
          Add Constant
        </button>
      </div>
        <AgGridReact
          rowData={dataService.constants_service.tableData.rows}
          columnDefs={dataService.constants_service.tableData.columns}
          ref={gridRef}
          theme={dataService.constants_service.getTheme()}
          onCellValueChanged={onCellValueChanged}
          animateRows={true}
          defaultColDef={{
            flex: 1,
            minWidth: 100,
            resizable: true,
          }}
        />
      </div>
    )
  );
};
