import { FC, useState, useRef, useEffect } from 'react';
import { Table } from '../Tables/Table';
import styles from './CohortTable.module.css';
import { CohortTableDataService } from './CohortTableDataService';
import { TableData } from '../../types/tableTypes';
import { SplitPane } from 'react-collapse-pane';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

interface CohortTableProps {
  data?: string;
  onAddPhenotype?: () => void;
}

export const CohortTable: FC<CohortTableProps> = ({ data, onAddPhenotype }) => {
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [cohortInfoPanelWidth] = useState(300);
  const [cohortName, setCohortName] = useState(data ?? '');
  const gridRef = useRef<any>(null);
  const quillRef = useRef<HTMLDivElement>(null);
  const [quillInstance, setQuillInstance] = useState<Quill | null>(null);

  useEffect(() => {
    if (quillRef.current && !quillInstance) {
      const quill = new Quill(quillRef.current, {
        theme: 'bubble',
        placeholder: 'Cohort description',
        modules: {
          toolbar: [
            ['bold', 'italic', 'underline'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['clean'],
          ],
        },
      });
      setQuillInstance(quill);
    }
  }, [quillRef.current]);

  useEffect(() => {
    if (data !== undefined) {
      console.log('Data prop changed:', data);
      setCohortName(data);
      const dataService = CohortTableDataService.getInstance();
      dataService.cohort_name = data;
      dataService.loadCohortData(data);
    }
  }, [data]);

  const dataService = CohortTableDataService.getInstance();
  if (data === undefined) {
    console.log('IS UNDEFINED< CREATING A NEW COHORT');
    dataService.createNewCohort();
  }
  dataService.cohort_name = cohortName;

  const onCellValueChanged = (event: any) => {
    dataService.onCellValueChanged(event);
  };

  const clickedAddPhenotype = () => {
    const updatedData = dataService.addPhenotype();
    if (gridRef.current?.api) {
      gridRef.current.api.applyTransaction(updatedData);
    }
    if (onAddPhenotype) {
      onAddPhenotype();
    }
  };

  return (
    <div className={styles.cohortTableContainer}>
      <div className={styles.topSection}>
        <input
          type="text"
          className={styles.cohortNameInput}
          placeholder="Name your cohort..."
          value={cohortName}
          onChange={e => {
            setCohortName(e.target.value);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const newValue = e.target.value;
              console.log('on enter', newValue);
              dataService.cohort_name = newValue;
              dataService.saveChangesToCohort();
            }
          }}
        />
        <div className={styles.buttonsContainer}>
          <button className={styles.reportButton} onClick={() => console.log('Report clicked')}>
            Generate report
          </button>
          <button className={styles.addPhenotypeButton} onClick={clickedAddPhenotype}>
            Add a Phenotype
          </button>
        </div>
      </div>
      <div className={styles.bottomSection}>
        {/* <SplitPane
          split="vertical"
        >
          <div className={styles.cohortInfoPanel}> */}
        {/* <div ref={quillRef} className={styles.cohortDescription} /> */}
        {/* </div> */}
        <div className={styles.rightPanel}>
          <Table
            data={data}
            dataService={dataService}
            onCellValueChanged={onCellValueChanged}
            gridRef={gridRef}
          />
        </div>
        {/* </SplitPane> */}
      </div>
    </div>
  );
};
