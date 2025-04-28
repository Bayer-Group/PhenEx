import React, { useState, useEffect } from 'react';
import styles from './CodelistsViewer.module.css';
import { Tabs } from '../Tabs/Tabs';
import { CohortDataService } from '../CohortViewer/CohortDataService/CohortDataService';
import { AgGridReact } from '@ag-grid-community/react';
import { FileDropZone } from './FileDropZone/FileDropZone';
import { CodelistInfoAccordianTabbedInfoDisplay } from './CodelistInfoAccordianTabbedInfoDisplay/CodelistInfoAccordianTabbedInfoDisplay';

export const CodelistsViewer: React.FC = () => {
  const [dataService] = useState(() => CohortDataService.getInstance());
  const [activeTab, setActiveTab] = useState(0);
  const [gridData, setGridData] = useState<{ columnDefs: any[], rowData: any[] }>({columnDefs: [], rowData: []});
  const [tabs, setTabs] = useState<string[]>(['All Codelists']);


  useEffect(() => {
    const handleFilenamesChange = () => {
      // setGridData(dataService.codelists_service.prepareAllCodelistsData());
      console.log(dataService.codelists_service._filenames, "HANDLE FiLENAMES")
      setTabs(['All Codelists', ...(dataService.codelists_service._filenames || [])]);
    };

    handleFilenamesChange();
    dataService.codelists_service.addListener(handleFilenamesChange);
    return () => {
      dataService.codelists_service.removeListener(handleFilenamesChange);
    };
  }, [dataService]);

  const handleTabChange = (index: number) => {
    setActiveTab(index);
    dataService.codelists_service.setActiveFile(index);
    setGridData(index === 0 ? dataService.codelists_service.prepareAllCodelistsData() : dataService.codelists_service.prepareFileData(index));
  };

  useEffect(() => {
    setGridData(dataService.codelists_service.prepareAllCodelistsData());
  }, []);

  const handleFileDrop = (files: FileList) => {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          dataService.codelists_service.addFile({ filename: file.name, contents: content });
          setGridData(dataService.codelists_service.prepareAllCodelistsData());
        } catch (error) {
          console.error('Error parsing file:', error);
        }
      };
      reader.readAsText(file);
    });
  };

  return (
    <FileDropZone onFileDrop={handleFileDrop}>
      <div className={styles.container}>
        <div className={styles.title}>Codelists</div>
        <div className={styles.tabsContainer}>
          <Tabs
            width="100%"
            height={40}
            tabs={tabs}
            active_tab_index={activeTab}
            onTabChange={handleTabChange}
          />
        </div>
        <div className={styles.bottomSection}>
          <div className = {styles.infoBox}>
            {activeTab !== 0 && (
              <CodelistInfoAccordianTabbedInfoDisplay title={tabs[activeTab]} />
            )}
          </div>
          <div className={styles.tableBox} style={{ height: 'calc(100vh - 150px)', width: '100%' }}>
            <AgGridReact
              rowData={gridData.rowData}
              columnDefs={gridData.columnDefs}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true
              }}
              animateRows={true}
              theme={dataService.codelists_service.getTheme()}
            />
          </div>
        </div>
      </div>
    </FileDropZone>
  );
};
