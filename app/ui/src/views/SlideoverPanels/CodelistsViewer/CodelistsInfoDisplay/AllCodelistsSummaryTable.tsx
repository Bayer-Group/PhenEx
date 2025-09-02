import React, { useEffect, useState, useRef, act } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { CohortDataService } from '../../../CohortViewer/CohortDataService/CohortDataService';
import styles from './AllCodelistsSummaryTable.module.css';

export const AllCodelistsSummaryTable: React.FC = () => {
  const dataService = useRef(CohortDataService.getInstance()).current;
  const gridRef = useRef<any>(null);
  const [activeFile, setActiveFile] = useState(dataService.codelists_service.activeFile);

  const refreshGrid = () => {
    setActiveFile(dataService.codelists_service.activeFile);
  };

  useEffect(() => {
    const listener = () => refreshGrid();
    dataService.codelists_service.addListener(listener);

    return () => {
      dataService.codelists_service.removeListener(listener);
    };
  }, [dataService]);

  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.setRowData(getRowData());
    }
  }, [activeFile]);

  const getColumnDefs = () => {
    return [
      {
        headerName: 'Codelist Name',
        field: 'codelist_name',
        resizable: true,
        minWidth: 150,
      },
      {
        headerName: 'Number of Codes',
        field: 'n_codes',
        resizable: true,
        minWidth: 120,
      },
      {
        headerName: 'Source file',
        field: 'filename',
        resizable: true,
        minWidth: 120,
      },
    ];
  };

  const getRowData = () => {
    return dataService.codelists_service.summarizeAllCodelistFiles();
  };

  return (
    <div className={styles.gridContainer}>
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
