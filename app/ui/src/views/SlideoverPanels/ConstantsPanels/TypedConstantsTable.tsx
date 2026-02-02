import React, { useEffect, useRef } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { ColDef } from '@ag-grid-community/core';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import { ConstantsCellRenderer } from '../ConstantsPanel/ConstantsCellRenderer';
import { ConstantsCellEditorSelector } from '../ConstantsPanel/ConstantsCellEditorSelector';

import styles from './ConstantsPanels.module.css';
import RowDragCellRenderer from '../../CohortViewer/CohortTable/CellRenderers/RowDragCellRenderer';
const NAME_VALUE_COLUMNS: ColDef[] = [
  {
    field: 'rowDrag',
    headerName: '',
    width: 30,
    minWidth: 30,
    maxWidth: 30,
    pinned: 'left',
    rowDrag: true,
    resizable: false,
    filter: false,
    cellClass: 'row-drag-handle',
    cellRenderer: RowDragCellRenderer,
  },
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
  {
    field: 'delete',
    headerName: 'Delete',
    width: 20,
    minWidth: 20,
    maxWidth: 20,
    editable: false,
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
              suppressNoRowsOverlay
              defaultColDef={{
                flex: 1,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
