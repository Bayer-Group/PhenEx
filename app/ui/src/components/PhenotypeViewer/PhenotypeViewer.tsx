import React, { useEffect, useState, useRef } from 'react';
import styles from './PhenotypeViewer.module.css';
import { AgGridReact } from '@ag-grid-community/react';
import { PhenotypeDataService, Phenotype } from '../../services/PhenotypeDataService';

interface PhenotypeViewerProps {
  data?: Phenotype;
}

export const PhenotypeViewer: React.FC<PhenotypeViewerProps> = ({ data }) => {
  const dataService = useRef(PhenotypeDataService.getInstance()).current;
  const gridRef = useRef<any>(null);

  const refreshGrid = () => {
    console.log("refesh the phenotyppppp", dataService.getRowData())
    if (gridRef.current?.api) {
      const api = gridRef.current.api;
      const firstRow = api.getFirstDisplayedRow();
      const lastRow = api.getLastDisplayedRow();

      api.setGridOption('rowData', dataService.rowData);

      requestAnimationFrame(() => {
        api.ensureIndexVisible(firstRow, 'top');
        api.ensureIndexVisible(lastRow, 'bottom');
      });
    }
  };

  useEffect(() => {
    const listener = () => refreshGrid();
    dataService.addListener(listener);
    dataService.setData(data);

    return () => {
      dataService.removeListener(listener);
    };
  }, [data, dataService]);

  if (!data) {
    return (
      <div className={styles.container}>
        <h2>Select a phenotype to view details</h2>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>{data.name}</h2>
        <div className={styles.info}>{dataService.formatType()}</div>
      </div>
      <div className={`${styles.gridContainer}`}>
        <AgGridReact
          rowData={dataService.rowData}
          columnDefs={dataService.getColumnDefs()}
          ref={gridRef}
          theme={dataService.getTheme()}
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
