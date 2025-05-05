import React, { useEffect, useState, useRef } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import styles from './CodelistFileContent.module.css';

export const CodelistFileContent: React.FC = () => {
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
    ];
  };

  const summarizeCodelistFile = () => {
    if (!activeFile) return [];

    const codelistColumn = activeFile.codelist_column;
    const codeColumn = activeFile.code_column;
    const codeTypeColumn = activeFile.code_type_column;
    const data = activeFile.contents.data;

    // Get unique codelist names
    const uniqueCodelistNames = Array.from(new Set(data[codelistColumn]));

    // Calculate code counts for each codelist
    return uniqueCodelistNames.map(codelistName => {
      // Get indices where this codelist name appears
      const indices = data[codelistColumn]
        .map((name, idx) => (name === codelistName ? idx : -1))
        .filter(idx => idx !== -1);

      // Get codes and their types for these indices
      const codesByType = indices.reduce((acc, idx) => {
        const codeType = data[codeTypeColumn][idx];
        const code = data[codeColumn][idx];
        if (!acc[codeType]) acc[codeType] = new Set();
        acc[codeType].add(code);
        return acc;
      }, {});

      // Calculate total unique codes
      const totalCodes = Object.values(codesByType).reduce(
        (sum, codes: Set<string>) => sum + codes.size,
        0
      );

      return {
        codelist_name: codelistName,
        n_codes: totalCodes,
      };
    });
  };

  const getRowData = () => {
    return summarizeCodelistFile();
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
