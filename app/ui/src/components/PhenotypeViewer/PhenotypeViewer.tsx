import React, { useEffect, useState, useRef } from 'react';
import styles from './PhenotypeViewer.module.css';
import { AgGridReact } from '@ag-grid-community/react';
import { PhenotypeDataService, Phenotype } from './PhenotypeDataService';
import { EditableTextField } from '../EditableTextField/EditableTextField';

interface PhenotypeViewerProps {
  data?: Phenotype;
}

export const PhenotypeViewer: React.FC<PhenotypeViewerProps> = ({ data }) => {
  const dataService = useRef(PhenotypeDataService.getInstance()).current;
  const gridRef = useRef<any>(null);
  const [phenotypeName, setPhenotypeName] = useState('');

  const refreshGrid = () => {
    const maxRetries = 5;
    const retryDelay = 100; // milliseconds
    let retryCount = 0;
    
    const tryRefresh = () => {
      if (gridRef.current?.api) {
        const api = gridRef.current.api;
        const firstRow = api.getFirstDisplayedRow();
        const lastRow = api.getLastDisplayedRow();

        api.setGridOption('rowData', dataService.rowData);

        requestAnimationFrame(() => {
          api.ensureIndexVisible(firstRow, 'top');
          api.ensureIndexVisible(lastRow, 'bottom');
        });
      } else if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(tryRefresh, retryDelay);
      }
    };
    // refresh ag-grid when new data is available. 
    // if ag-grid is not ready, retry after a delay.
    tryRefresh();
  };

  useEffect(() => {
    const listener = (refreshPhenotypeGrid: boolean = false) => {
      if (refreshPhenotypeGrid) {
        refreshGrid();
      }
    }
    dataService.addListener(listener);

    if (data) {
      dataService.setData(data);
      setPhenotypeName(data.name)
    }

    return () => {
      dataService.removeListener(listener);
    };
  }, [data]);


  const onCellValueChanged = async (event: any) => {
    if (event.newValue !== event.oldValue) {
      dataService.valueChanged(event.data, event.newValue)
    }
  };

  const onSaveNameChanges = () => {
    if (data) {
      dataService.valueChanged({parameter: 'name', value: phenotypeName}, phenotypeName);
    }
  };

  const renderType = () => {
    const type = data?.type
    let s = '';
    if (type == 'entry') {
      s = 'Entry Criterion';
    } else if (type == 'inclusion') {
      s = 'Inclusion Criterion';
    } else if (type == 'exclusion') {
      s = 'Exclusion Criterion';
    } else if (type == 'baseline') {
      s = 'Baseline Characteristic';
    } else if (type == 'outcome') {
      s = 'Outcome';
    }

    return (
      <>
        <span
          className={`${styles.phenotypeType} rag-${type === 'entry' ? 'dark' : type === 'inclusion' ? 'blue' : type === 'exclusion' ? 'green' : type === 'baseline' ? 'coral' : type === 'outcome' ? 'red' : ''}-outer`}
        >
          {s}
        </span>
        in {dataService.getCohortName()}
      </>
  );
  }



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
      <EditableTextField
          value={phenotypeName}
          placeholder="Name your cohort..."
          className={styles.phenotypeNameInput}
          onChange={(newValue) => {
            setPhenotypeName(newValue)
          }}
          onSaveChanges={onSaveNameChanges}
        />
        <div className={styles.info}>{renderType()}</div>
        <textarea
          className={styles.description}
          value={data?.description || ''}
          onChange={(e) => {
            if (dataService.currentPhenotype) {
              dataService.currentPhenotype.description = e.target.value;
              dataService.valueChanged({parameter: 'description', value: e.target.value}, e.target.value);
            }
          }}
          placeholder="Enter description..."
        />
      </div>
      <div className={`${styles.gridContainer}`}>
        <AgGridReact
          rowData={dataService.rowData}
          columnDefs={dataService.getColumnDefs()}
          ref={gridRef}
          theme={dataService.getTheme()}
          onCellValueChanged={onCellValueChanged}
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
