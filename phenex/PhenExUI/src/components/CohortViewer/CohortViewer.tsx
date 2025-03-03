import { FC, useState, useRef, useEffect } from 'react';
import styles from './CohortViewer.module.css';
import { CohortTableHeader } from './CohortTableHeader';
import { CohortDataService } from './CohortDataService';
import { TableData } from './tableTypes';
import { CohortTable } from './CohortTable/CohortTable';

import Quill from 'quill';
import 'quill/dist/quill.snow.css';

interface CohortViewerProps {
  data?: string;
  onAddPhenotype?: () => void;
}

export const CohortViewer: FC<CohortViewerProps> = ({ data, onAddPhenotype }) => {
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [cohortInfoPanelWidth] = useState(300);
  const [cohortName, setCohortName] = useState(data ?? '');
  const gridRef = useRef<any>(null);
  const quillRef = useRef<HTMLDivElement>(null);
  const [quillInstance, setQuillInstance] = useState<Quill | null>(null);
  const [dataService] = useState(() => CohortDataService.getInstance());

  useEffect(() => {
    const loadData = async () => {
      if (data !== undefined) {
        console.log('Data prop changed:', data);
        await dataService.loadCohortData(data);
      } else {
        console.log('Creating a new cohort');
        dataService.createNewCohort();
      }
      setTableData(dataService.table_data);
      setCohortName(dataService.cohort_name);
    };
    loadData();
  }, [data]);

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

  const onCellValueChanged = async (event: any) => {
    console.log('Cell value changed:', event);
    const isTypeChange = event.colDef.field === 'type';
    if (event.newValue !== event.oldValue) {
      console.log(
        'Value actually changed:',
        { old: event.oldValue, new: event.newValue },
        event.field
      );
      dataService.onCellValueChanged(event);
      setTableData(dataService.table_data);

      if (isTypeChange && gridRef.current?.api) {
        gridRef.current.api.redrawRows();
      }
      console.log('Updated table data:', dataService.table_data);
    }
  };

  const clickedAddPhenotype = async (type: string) => {
    const updatedData = dataService.addPhenotype(type);
    if (gridRef.current?.api) {
      gridRef.current.api.applyTransaction(updatedData);
    }
    setTableData(dataService.table_data);
    if (onAddPhenotype) {
      onAddPhenotype();
    }
  };

  return (
    <div className={styles.cohortTableContainer}>
      <CohortTableHeader
        cohortName={cohortName}
        dataService={dataService}
        onCohortNameChange={setCohortName}
        onSaveChanges={async () => {
          await dataService.saveChangesToCohort();
        }}
        onAddPhenotype={clickedAddPhenotype}
      />
      <div className={styles.bottomSection}>
        {/* <SplitPane
          split="vertical"
        >
          <div className={styles.cohortInfoPanel}> */}
        {/* <div ref={quillRef} className={styles.cohortDescription} /> */}
        {/* </div> */}
        <div className={styles.rightPanel}>
        <CohortTable
          data={dataService.table_data}
          onCellValueChanged={onCellValueChanged}
          ref={gridRef}
        />
        </div>
        {/* </SplitPane> */}
      </div>
    </div>
  );
};
