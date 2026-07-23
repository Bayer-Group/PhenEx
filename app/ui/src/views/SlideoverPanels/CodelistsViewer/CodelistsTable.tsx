import React, { useEffect, useMemo, useRef } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { ColDef } from '@ag-grid-community/core';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import InfoPanelRowDragCellRenderer from '../ConstantsPanels/InfoPanelRowDragCellRenderer';
import InfoPanelDeleteCellRenderer from '../ConstantsPanels/InfoPanelDeleteCellRenderer';
import { deleteCodelist, updateCodelistDisplayOrder } from '../../../api/codelists/route';
import styles from '../ConstantsPanels/ConstantsPanels.module.css';

const CODELIST_COLUMNS: ColDef[] = [
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
    field: 'filename',
    headerName: 'Filename',
    flex: 1,
    editable: false,
  },
  {
    field: 'codelists',
    headerName: 'Codelists',
    flex: 2,
    editable: false,
    valueFormatter: (params) => {
      if (Array.isArray(params.value)) {
        return params.value.join(', ');
      }
      return params.value || '';
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

interface CodelistsTableProps {
  codelists: any[];
  onCodelistsChanged: () => void;
}

export const CodelistsTable: React.FC<CodelistsTableProps> = ({
  codelists,
  onCodelistsChanged,
}) => {
  const dataService = useRef(CohortDataService.getInstance()).current;
  const gridRef = useRef<any>(null);

  const columnDefs = useMemo<ColDef[]>(() => {
    return CODELIST_COLUMNS.map((col) =>
      col.field === 'delete'
        ? {
            ...col,
            cellRendererParams: {
              onDelete: async (data: any) => {
                if (data.id) {
                  try {
                    await deleteCodelist(data.id);
                    console.log(`Deleted codelist: ${data.filename}`);
                    // Refresh the codelists
                    await dataService.codelists_service.refresh();
                    onCodelistsChanged();
                  } catch (error) {
                    console.error(`Failed to delete codelist ${data.filename}:`, error);
                    alert(`Failed to delete codelist: ${data.filename}`);
                  }
                }
              },
            },
          }
        : col
    );
  }, [dataService, onCodelistsChanged]);

  const onRowDragEnd = async (event: any) => {
    if (!event.api || event.node?.rowIndex == null) return;

    const orderedCodelists: any[] = [];
    event.api.forEachNodeAfterFilterAndSort((node: any) => {
      if (node.data) {
        orderedCodelists.push(node.data);
      }
    });

    // Update display_order for each codelist
    try {
      for (let i = 0; i < orderedCodelists.length; i++) {
        const codelist = orderedCodelists[i];
        if (codelist.id && codelist.display_order !== i) {
          await updateCodelistDisplayOrder(codelist.id, i);
        }
      }
      console.log('Codelist display order updated');
      // Refresh the codelists
      await dataService.codelists_service.refresh();
      onCodelistsChanged();
    } catch (error) {
      console.error('Failed to update codelist display order:', error);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.bottomSection}>
        <div className={styles.tableBox}>
          <div className={styles.gridContainer}>
            <AgGridReact
              rowData={codelists}
              columnDefs={columnDefs}
              ref={gridRef}
              theme={dataService.codelists_service.getTheme()}
              onRowDragEnd={onRowDragEnd}
              rowDragManaged={true}
              animateRows={true}
              headerHeight={30}
              domLayout="autoHeight"
              suppressNoRowsOverlay
              defaultColDef={{
                resizable: true,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
