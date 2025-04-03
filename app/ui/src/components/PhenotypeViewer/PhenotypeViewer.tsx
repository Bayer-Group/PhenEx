import React, { useEffect, useMemo, useState } from 'react';
import styles from './PhenotypeViewer.module.css';
import { AgGridReact } from '@ag-grid-community/react';
import classDefinitions from '../../assets/class_definitions.json';
import { themeQuartz } from 'ag-grid-community';

interface Phenotype {
  name: string;
  description?: string;
  id?: string;
  class_name?: string;
  [key: string]: any;
}

interface PhenotypeViewerProps {
  data?: Phenotype;
}

interface ParamRow {
  parameter: string;
  value: string;
}

export const PhenotypeViewer: React.FC<PhenotypeViewerProps> = ({ data }) => {
  const [rowData, setRowData] = useState<ParamRow[]>([]);

  const columnDefs = useMemo(
    () => [
      { field: 'parameter', headerName: 'Parameter', sortable: true, filter: true },
      { field: 'value', headerName: 'Value', sortable: true, filter: true },
    ],
    []
  );

  useEffect(() => {
    if (data?.class_name && classDefinitions[data.class_name]) {
      const paramDefinitions = classDefinitions[data.class_name];
      const rows = paramDefinitions.map(paramDef => ({
        parameter: paramDef.param,
        value: data[paramDef.param]?.toString() || paramDef.default?.toString() || 'Not set',
      }));
      setRowData(rows);
    }
  }, [data]);

  if (!data) {
    return (
      <div className={styles.container}>
        <h2>Select a phenotype to view details</h2>
      </div>
    );
  }

  const myTheme = themeQuartz.withParams({
    accentColor: '#DDDDDD',
    borderColor: '#AFAFAF26',
    browserColorScheme: 'light',
    columnBorder: true,
    headerFontSize: 11,
    headerRowBorder: true,
    cellHorizontalPadding: 10,
    headerBackgroundColor: 'var(--background-color-content, #FFFFFF)',
    rowBorder: true,
    spacing: 8,
    wrapperBorder: false,
  });

  const formatType = () => {
    if (data.type == 'entry') {
      return 'Entry Criterion in Pacific AF ECA';
    } else if (data.type == 'inclusion') {
      return 'Inclusion Criterion in Pacific AF ECA';
    } else if (data.type == 'exclusion') {
      return 'Inclusion Criterion in Pacific AF ECA';
    } else if (data.type == 'baseline') {
      return 'Baseline Characteristics in Pacific AF ECA';
    } else if (data.type == 'outcome') {
      return 'Outcome in Pacific AF ECA';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>{data.name}</h2>
        <div className={styles.info}>{formatType()}</div>
      </div>
      <div className={`${styles.gridContainer}`}>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          theme={myTheme}
          animateRows={true}
          defaultColDef={{
            flex: 1,
            minWidth: 100,
            resizable: true,
          }}
        />
      </div>
    </div>
  );
};
