import React, { useEffect, useMemo, useRef } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { ColDef } from '@ag-grid-community/core';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import { ConstantsCellRenderer } from '../ConstantsPanel/ConstantsCellRenderer';
import { ConstantsCellEditorSelector } from '../ConstantsPanel/ConstantsCellEditorSelector';

import styles from './ConstantsPanels.module.css';
import InfoPanelRowDragCellRenderer from './InfoPanelRowDragCellRenderer';
import InfoPanelDeleteCellRenderer from './InfoPanelDeleteCellRenderer';
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
    cellRenderer: InfoPanelRowDragCellRenderer,
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
    width: 30,
    minWidth: 30,
    maxWidth: 30,
    editable: false,
    cellRenderer: InfoPanelDeleteCellRenderer,
    cellRendererParams: {}, // onDelete set in component
  },
];

interface TypedConstantsTableProps {
  constantType: string;
}

export const TypedConstantsTable: React.FC<TypedConstantsTableProps> = ({ constantType }) => {
  const dataService = useRef(CohortDataService.getInstance()).current;
  const gridRef = useRef<any>(null);

  const columnDefs = useMemo<ColDef[]>(() => {
    return NAME_VALUE_COLUMNS.map((col) =>
      col.field === 'delete'
        ? {
            ...col,
            cellRendererParams: {
              onDelete: (data: { _actualIndex?: number }) => {
                if (typeof data._actualIndex === 'number') {
                  dataService.constants_service.deleteConstantByActualIndex(data._actualIndex);
                }
              },
            },
          }
        : col
    );
  }, [dataService]);

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

  const onRowDragEnd = (event: any) => {
    if (!event.api || event.node?.rowIndex == null) return;
    const orderedActualIndices: number[] = [];
    event.api.forEachNodeAfterFilterAndSort((node: any) => {
      const actualIndex = node.data?._actualIndex;
      if (typeof actualIndex === 'number') orderedActualIndices.push(actualIndex);
    });
    if (orderedActualIndices.length > 0) {
      dataService.constants_service.reorderConstantsOfType(constantType, orderedActualIndices);
    }
  };

  const { rows } = dataService.constants_service.getRowsForType(constantType);

  return (
    <div className={styles.container}>
      <div className={styles.bottomSection}>
        <div className={styles.tableBox}>
          <div className={styles.gridContainer}>
            <AgGridReact
              rowData={rows}
              columnDefs={columnDefs}
              ref={gridRef}
              theme={dataService.constants_service.getTheme()}
              onCellValueChanged={onCellValueChanged}
              onRowDragEnd={onRowDragEnd}
              rowDragManaged={true}
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
