import React, { useRef } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { VisibilityDataService } from './VisibilityDataService';

export const VisibilityTable: React.FC = () => {
  const dataService = useRef(VisibilityDataService.getInstance()).current;
  const gridRef = useRef<any>(null);

  const onCellValueChanged = async (event: any) => {
    if (event.newValue !== event.oldValue && event.colDef.field === 'visible') {
      dataService.updateVisibility(event.data.column, event.newValue);
    }
  };

  return (
    <div style={{ width: '100%', height: '400px' }}>
      <AgGridReact
        rowData={dataService.tableData.rows}
        columnDefs={dataService.tableData.columns as any}
        ref={gridRef}
        theme={dataService.getTheme()}
        animateRows={true}
        onCellValueChanged={onCellValueChanged}
        defaultColDef={{
          flex: 1,
          minWidth: 100,
          resizable: true,
        }}
      />
    </div>
  );
};
