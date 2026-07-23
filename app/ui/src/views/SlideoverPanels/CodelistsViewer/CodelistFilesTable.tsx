import React, { useEffect, useState, useRef } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { ColDef } from '@ag-grid-community/core';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import InfoPanelRowDragCellRenderer from '../ConstantsPanels/InfoPanelRowDragCellRenderer';
import InfoPanelDeleteCellRenderer from '../ConstantsPanels/InfoPanelDeleteCellRenderer';
import styles from '../ConstantsPanels/ConstantsPanels.module.css';

const CODELIST_FILE_COLUMNS: ColDef[] = [
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
    field: 'delete',
    headerName: '',
    width: 30,
    minWidth: 30,
    maxWidth: 30,
    editable: false,
    cellRenderer: InfoPanelDeleteCellRenderer,
    cellRendererParams: {}, // onDelete set in component
  },
];

interface CodelistFilesTableProps {
  onFileSelect?: (fileId: string | null) => void;
  selectedFileId?: string | null;
}

export const CodelistFilesTable: React.FC<CodelistFilesTableProps> = ({ onFileSelect, selectedFileId }) => {
  const dataService = useRef(CohortDataService.getInstance()).current;
  const gridRef = useRef<any>(null);
  const [rowData, setRowData] = useState<any[]>([]);

  const refreshData = () => {
    const metadata = dataService.codelists_service.filesMetadata || [];
    setRowData([...metadata]);
  };

  useEffect(() => {
    refreshData();
    const listener = () => refreshData();
    dataService.codelists_service.addListener(listener);
    return () => {
      dataService.codelists_service.removeListener(listener);
    };
  }, [dataService]);

  const columnDefs = React.useMemo<ColDef[]>(() => {
    return CODELIST_FILE_COLUMNS.map((col) =>
      col.field === 'delete'
        ? {
            ...col,
            cellRendererParams: {
              onDelete: async (data: any) => {
                if (data.id) {
                  try {
                    await dataService.codelists_service.deleteFile(data.id);
                  } catch (error) {
                    console.error(`Failed to delete codelist ${data.filename}:`, error);
                  }
                }
              },
            },
          }
        : col
    );
  }, [dataService]);

  const onRowDragEnd = async (event: any) => {
    if (!event.api || event.node?.rowIndex == null) return;

    const orderedFiles: any[] = [];
    event.api.forEachNodeAfterFilterAndSort((node: any) => {
      if (node.data) {
        orderedFiles.push(node.data);
      }
    });

    // Update display_order for each file
    try {
      for (let i = 0; i < orderedFiles.length; i++) {
        const file = orderedFiles[i];
        if (file.id && file.display_order !== i) {
          await dataService.codelists_service.updateFileDisplayOrder(file.id, i);
        }
      }
      await dataService.codelists_service.refresh();
    } catch (error) {
      console.error('Failed to update codelist file display order:', error);
    }
  };

  const onRowClicked = (event: any) => {
    if (onFileSelect && event.data) {
      onFileSelect(event.data.id);
    }
  };

  const getRowStyle = (params: any) => {
    if (params.data?.id === selectedFileId) {
      return { backgroundColor: 'var(--selected-row-background, #e8f0fe)' };
    }
    return undefined;
  };

  return (
    <div className={styles.container}>
      <div className={styles.bottomSection}>
        <div className={styles.tableBox}>
          <div className={styles.gridContainer}>
            <AgGridReact
              rowData={rowData}
              columnDefs={columnDefs}
              ref={gridRef}
              theme={dataService.codelists_service.getTheme()}
              onRowDragEnd={onRowDragEnd}
              onRowClicked={onRowClicked}
              getRowStyle={getRowStyle}
              rowDragManaged={true}
              animateRows={true}
              headerHeight={0}
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
