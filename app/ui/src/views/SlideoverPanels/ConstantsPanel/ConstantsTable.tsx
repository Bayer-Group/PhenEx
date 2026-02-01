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
    if (event.newValue !== event.oldValue) {
      const field = event.colDef.field;
      const rowIndex = event.rowIndex;
      dataService.constants_service.valueChanged(rowIndex, field, event.newValue);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.topSection}>
        <div className={styles.controls}>
          <button onClick={addConstant} className={styles.addButton}>
            Add Constant
          </button>
        </div>
      </div>
      <div className={styles.bottomSection}>
        <div className={styles.tableBox}>
          <div className={styles.gridContainer}>
            <AgGridReact
              rowData={dataService.constants_service.tableData.rows}
              columnDefs={dataService.constants_service.tableData.columns}
              ref={gridRef}
              theme={dataService.constants_service.getTheme()}
              onCellValueChanged={onCellValueChanged}
              animateRows={true}
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
