import React, { useState, useEffect } from 'react';
import styles from './CodelistsViewer.module.css';
import { Tabs } from '../Tabs/Tabs';
import { CodelistDataService } from '../CohortViewer/CohortDefinitionView/CodelistsInfoDisplay/CodelistDataService';
import { AgGridReact } from '@ag-grid-community/react';

export const CodelistsViewer: React.FC = () => {
  const [dataService] = useState(() => CodelistDataService.getInstance());
  const [activeTab, setActiveTab] = useState(0);
  const [gridData, setGridData] = useState<{ columnDefs: any[], rowData: any[] }>({
    columnDefs: [],
    rowData: []
  });

  // Create tabs array with 'All Codelists' and filenames
  const tabs = ['All Codelists', ...dataService.files.map(file => file.filename)];

  const prepareAllCodelistsData = () => {
    const columnDefs = [
      { field: 'code', headerName: 'Code', flex: 1 },
      { field: 'vocabulary', headerName: 'Vocabulary', flex: 1 },
      { field: 'codelist', headerName: 'Codelist', flex: 1 },
      { field: 'source', headerName: 'Source File', flex: 1 }
    ];

    const rowData = dataService.files.flatMap(file => 
      file.contents.concept_id.map((code: string, index: number) => ({
        code: code,
        vocabulary: file.contents.vocabulary[index],
        codelist: file.contents.codelist[index],
        source: file.filename
      }))
    );

    return { columnDefs, rowData };
  };

  const prepareFileData = (fileIndex: number) => {
    const file = dataService.files[fileIndex - 1];
    const columnDefs = [
      { field: 'code', headerName: 'Code', flex: 1 },
      { field: 'vocabulary', headerName: 'Vocabulary', flex: 1 },
      { field: 'codelist', headerName: 'Codelist', flex: 1 }
    ];

    const rowData = file.contents.concept_id.map((code: string, index: number) => ({
      code: code,
      vocabulary: file.contents.vocabulary[index],
      codelist: file.contents.codelist[index]
    }));

    return { columnDefs, rowData };
  };

  const handleTabChange = (index: number) => {
    setActiveTab(index);
    setGridData(index === 0 ? prepareAllCodelistsData() : prepareFileData(index));
  };

  useEffect(() => {
    setGridData(prepareAllCodelistsData());
  }, []);

  return (
    <div className={styles.container}>
      <h2>Codelists</h2>
      <Tabs
        width="100%"
        height={40}
        tabs={tabs}
        active_tab_index={activeTab}
        onTabChange={handleTabChange}
      />
      <div className={styles.contentContainer}>
        <div className={styles.gridContainer} style={{ height: 'calc(100vh - 150px)', width: '100%' }}>
          <AgGridReact
            rowData={gridData.rowData}
            columnDefs={gridData.columnDefs}
            defaultColDef={{
              sortable: true,
              filter: true,
              resizable: true
            }}
            animateRows={true}
            theme={dataService.getTheme()}

          />
        </div>
      </div>
    </div>
  );
};
