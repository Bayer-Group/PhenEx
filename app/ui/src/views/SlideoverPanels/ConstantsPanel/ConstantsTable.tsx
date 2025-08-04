import React, { useEffect, useState, useRef } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';

export const ConstantsTable: React.FC = () => {
  const dataService = useRef(CohortDataService.getInstance()).current;
  const gridRef = useRef<any>(null);

  const refreshGrid = () => {
    if (gridRef.current?.api) {
      const api = gridRef.current.api;
      const firstRow = api.getFirstDisplayedRow();
      const lastRow = api.getLastDisplayedRow();

      api.setGridOption('rowData', dataService.constants_service.tableData);

      requestAnimationFrame(() => {
        api.ensureIndexVisible(firstRow, 'top');
        api.ensureIndexVisible(lastRow, 'bottom');
      });
    }
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
      dataService.valueChanged(event.data, event.newValue);
    }
  };

  return (
    console.log('CONSTANTS DATA', dataService.constants_service.tableData),
    (
      <div style={{ width: '100%', height: '400px' }}>
        <AgGridReact
          rowData={dataService.constants_service.tableData.rows}
          columnDefs={dataService.constants_service.tableData.columns}
          ref={gridRef}
          theme={dataService.constants_service.getTheme()}
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
