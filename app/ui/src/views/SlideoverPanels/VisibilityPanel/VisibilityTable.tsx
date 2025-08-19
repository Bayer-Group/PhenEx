import React, { useRef } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { VisibilityDataService } from './VisibilityDataService';

export const VisibilityTable: React.FC = () => {
  const dataService = useRef(VisibilityDataService.getInstance()).current;
  const gridRef = useRef<any>(null);

  const onCellValueChanged = async (event: any) => {
    if (event.newValue !== event.oldValue && event.colDef.field === 'visible') {
      dataService.updateVisibility(event.data.column, event.newValue);
      
      // Refresh the grid with sorted data
      if (gridRef.current?.api) {
        gridRef.current.api.setGridOption('rowData', dataService.tableData.rows);
      }
    }
  };

  const onRowDragEnd = (event: any) => {
    const movingNode = event.node;
    const overNode = event.overNode;
    
    if (movingNode && overNode && movingNode !== overNode) {
      const fromIndex = movingNode.rowIndex;
      const toIndex = overNode.rowIndex;
      
      dataService.reorderRows(fromIndex, toIndex);
      
      // Refresh the grid
      if (gridRef.current?.api) {
        gridRef.current.api.setGridOption('rowData', dataService.tableData.rows);
      }
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
        onRowDragEnd={onRowDragEnd}
        rowDragManaged={true}
        defaultColDef={{
          flex: 1,
          minWidth: 100,
          resizable: true,
        }}
      />
    </div>
  );
};
