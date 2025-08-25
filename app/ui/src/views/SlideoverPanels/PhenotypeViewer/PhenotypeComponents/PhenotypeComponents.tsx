import { FC, useState, useRef, useEffect } from 'react';
import styles from './PhenotypeComponents.module.css';
import { PhenotypeDataService } from '../PhenotypeDataService';
import { CohortTable } from '../../../CohortViewer/CohortTable/CohortTable';
import typeStyles from '../../../../styles/study_types.module.css';

interface PhenotypeComponentsProps {
  data?: string;
}

export const PhenotypeComponents: FC<PhenotypeComponentsProps> = ({ data }) => {
  const gridRef = useRef<any>(null);
  const [dataService] = useState(() => PhenotypeDataService.getInstance());
  const [tableData, setTableData] = useState(dataService.componentPhenotypeTableData);

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
      // Update the state to trigger re-render
      setTableData(dataService.componentPhenotypeTableData);

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

  useEffect(() => {
    const listener = (refreshPhenotypeGrid: boolean = false) => {
      if (refreshPhenotypeGrid) {
        refreshGrid();
      }
    };
    dataService.addListener(listener);

    if (data) {
      console.log('SETTING DATA', data);
      dataService.setData(data);
    }

    return () => {
      dataService.removeListener(listener);
    };
  }, [data]);

  // Update table data when the phenotype data changes
  useEffect(() => {
    setTableData(dataService.componentPhenotypeTableData);
  }, [data]);

  const onCellValueChanged = async (event: any) => {
    if (event.newValue !== event.oldValue) {
      dataService.valueChanged(event.data, event.newValue);
    }
  };

  const clickedOnAddButton = (e: React.MouseEvent) => {
    dataService.addNewComponentPhenotype();
  };

  return (
    <div className={styles.phenotypeContainer}>
      <div className={styles.header}>
        <button
          className={`${styles.addButton} ${typeStyles[`${data.type}_color_text_and_border_on_hover`]}`}
          onClick={clickedOnAddButton}
        >
          Add Component
        </button>
      </div>
      <div className={styles.tableBox}>
        <CohortTable
          data={tableData}
          onCellValueChanged={onCellValueChanged}
          ref={gridRef}
          currentlyViewing={'components'}
        />
      </div>
    </div>
  );
};
