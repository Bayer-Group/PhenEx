import { FC, useState, useRef, useEffect } from 'react';
import styles from './PhenotypeComponents.module.css';
import { PhenotypeDataService } from '../PhenotypeDataService';
import { CohortTable } from '../../../CohortViewer/CohortTable/CohortTable';

interface PhenotypeComponentsProps {
  data?: string;
}

export const PhenotypeComponents: FC<PhenotypeComponentsProps> = ({ data }) => {
  const gridRef = useRef<any>(null);
  const [dataService] = useState(() => PhenotypeDataService.getInstance());

  const refreshGrid = () => {
    const maxRetries = 5;
    const retryDelay = 100; // milliseconds
    let retryCount = 0;

    const tryRefresh = () => {
      console.log('THERE IS  gridfRE', gridRef);
      if (gridRef.current?.api) {
        const api = gridRef.current.api;
        const firstRow = api.getFirstDisplayedRow();
        const lastRow = api.getLastDisplayedRow();
        console.log('TRYING REFRESH');
        console.log(dataService.componentPhenotypeTableData);
        api.setGridOption('rowData', dataService.componentPhenotypeTableData.rows);
        console.log('THERE IS  gridfREAFTER', gridRef);

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
      console.log(
        'REFRESHING GRID ATTMPET',
        refreshPhenotypeGrid,
        dataService.componentPhenotypeTableData
      );
      if (refreshPhenotypeGrid) {
        refreshGrid();
      }
    };
    console.log('IA M ADDING A COMPONENT PHENOTYPE LISTNERE');
    dataService.addComponentPhenotypeListener(listener);

    return () => {
      dataService.removeListener(listener);
    };
  }, []);

  const onCellValueChanged = async (event: any) => {
    if (event.newValue !== event.oldValue) {
      dataService.onCellValueChanged(event);
    }
  };

  return (
    <div className={styles.phenotypeContainer}>
      <div className={styles.tableBox}>
        <CohortTable
          data={dataService.componentPhenotypeTableData}
          onCellValueChanged={onCellValueChanged}
          ref={gridRef}
          currentlyViewing = {'components'}
        />
      </div>
    </div>
  );
};
