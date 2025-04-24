import React, { useEffect, useState, useRef } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';

export const CodelistColumnMapping: React.FC = () => {
  const dataService = useRef(CohortDataService.getInstance()).current;
  const gridRef = useRef<any>(null);
  const [activeFile, setActiveFile] = useState(dataService.codelists_service.activeFile);

  const refreshGrid = () => {
    setActiveFile(dataService.codelists_service.activeFile);
  };

  useEffect(() => {
    const listener = () => refreshGrid();
    dataService.addListener(listener);

    return () => {
      dataService.removeListener(listener);
    };
  }, [dataService]);

  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.setRowData(getRowData());
    }
  }, [activeFile]);

  const getColumnDefs = () => {
    const columnDefs = [
      {
        headerName: 'Content',
        field: 'content',
        filter: 'agTextColumnFilter',
        sortable: true,
        resizable: true,
        minWidth: 100,
      },
      {
        headerName: 'Column in your database',
        field: 'mapped_column',
        filter: 'agTextColumnFilter',
        sortable: true,
        resizable: true,
        minWidth: 100,
      }
    ];
    return columnDefs;
  }

  const getRowData = () => {
    console.log("CODELIST DATA getRowData",dataService.codelists_service.activeFile);
    if (activeFile === null) {
      return [];
    }

    const rowData = [
      {
        content: 'code',
        mapped_column: activeFile.code_column,
      },
      {
        content: 'code_type',
        mapped_column: activeFile.code_type_column,
      },
      {
        content: 'code_list',
        mapped_column: activeFile.codelist_column,
      },
    ]
    return rowData;
  }

  return (
    <div style={{ width: '100%', height: '400px' }}>
      <AgGridReact
        rowData={getRowData()}
        columnDefs={getColumnDefs()}
        ref={gridRef}
        theme={dataService.codelists_service.getTheme()}
        animateRows={true}
        defaultColDef={{
          flex: 1,
          minWidth: 100,
          resizable: true,
        }}
      />
    </div>
  );
};