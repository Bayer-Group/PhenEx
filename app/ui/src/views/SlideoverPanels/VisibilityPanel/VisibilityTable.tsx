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

  const onRowDragEnd = () => {
    console.log("ON ROW DRAG END");
    
    // Just get the current order from the grid and update indices
    const newRowData: any[] = [];
    if (gridRef.current?.api) {
      gridRef.current.api.forEachNode((node: any) => {
        newRowData.push(node.data);
      });
    }
    
    // Update indices for visible rows based on their current positions
    const visibleRows = newRowData.filter(row => row.visible);
    visibleRows.forEach((row, index) => {
      row.index = index;
    });
    
    console.log("Updated visible rows:", visibleRows);
    
    // Update the service data using the public method
    dataService.updateRowOrder(newRowData);
    
    // Refresh the grid
    if (gridRef.current?.api) {
      gridRef.current.api.setGridOption('rowData', dataService.tableData.rows);
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
