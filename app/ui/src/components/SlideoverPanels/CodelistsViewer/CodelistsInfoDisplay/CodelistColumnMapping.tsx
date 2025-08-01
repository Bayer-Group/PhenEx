import React, { useEffect, useState, useRef } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { CohortDataService } from '../../../CohortViewer/CohortDataService/CohortDataService';
import DescriptionCellRenderer from '../../../CohortViewer/CohortTable/CellRenderers/DescriptionCellRenderer';
import styles from './CodelistColumnMapping.module.css';

export const CodelistColumnMapping: React.FC = () => {
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

  const onCellValueChanged = event => {
    const field = event.data.content + '_column';
    console.log('onCellValueChanged', event, field);
    dataService.codelists_service.activeFile[field] = event.newValue;
    console.log('CODELIST DATA onCellValueChanged', dataService.codelists_service.activeFile);
    dataService.codelists_service.saveChangesToActiveFile();
  };

  const getColumnDefs = () => {
    const columnDefs = [
      {
        headerName: 'Required',
        field: 'content',
        resizable: true,
        minWidth: 80,
      },

      {
        headerName: 'Column name (in file)',
        field: 'mapped_column',
        resizable: true,
        minWidth: 100,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: dataService.codelists_service.activeFile?.contents.headers,
        },
      },
      {
        headerName: 'Info',
        field: 'info',
        resizable: true,
        minWidth: 100,
        cellStyle: {
          fontSize: '8px',
          whiteSpace: 'normal',
          lineHeight: '1.2',
        },
      },
    ];
    return columnDefs;
  };

  const getRowData = () => {
    console.log('CODELIST DATA getRowData', dataService.codelists_service.activeFile);
    if (activeFile === null) {
      return [];
    }

    const rowData = [
      {
        content: 'code',
        mapped_column: activeFile.code_column,
        info: 'The name of the column that contains medical codes suchs as I63.2, 89280, etc.',
      },
      {
        content: 'code_type',
        mapped_column: activeFile.code_type_column,
        info: "The name of the column that contains the type of medical codes suchs as ICD10CM, NDC, etc. Also known as 'ontology' or 'vocabulary'.",
      },
      {
        content: 'codelist',
        mapped_column: activeFile.codelist_column,
        info: 'The name of the column that contains the name of the codelist or medical concept of interest.',
      },
    ];
    return rowData;
  };

  return (
    <div className={styles.container}>
      <div className={styles.top}>
        <p className={styles.description}>
          Create a default mapping for this file. Identify which columns in your source file map to
          three required columns.
        </p>
      </div>
      <div className={styles.bottom}>
        <AgGridReact
          rowData={getRowData()}
          columnDefs={getColumnDefs()}
          ref={gridRef}
          theme={dataService.codelists_service.getTheme()}
          animateRows={true}
          defaultColDef={{
            onCellValueChanged: onCellValueChanged,
            flex: 1,
            minWidth: 100,
            resizable: true,
          }}
        />
      </div>
    </div>
  );
};
