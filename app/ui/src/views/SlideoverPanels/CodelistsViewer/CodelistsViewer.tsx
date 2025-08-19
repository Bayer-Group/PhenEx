import React, { useState, useEffect } from 'react';
import styles from './CodelistsViewer.module.css';
import { TabsWithDropdown } from '../../../components/ButtonsAndTabs/Tabs/TabsWithDropdown';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import { AgGridReact } from '@ag-grid-community/react';
import { FileDropZone } from './FileDropZone/FileDropZone';
import { CodelistInfoAccordianTabbedInfoDisplay } from './CodelistInfoAccordianTabbedInfoDisplay/CodelistInfoAccordianTabbedInfoDisplay';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';

export const CodelistsViewer: React.FC = () => {
  const [dataService] = useState(() => CohortDataService.getInstance());
  const [activeTab, setActiveTab] = useState(0);
  const [gridData, setGridData] = useState<{ columnDefs: any[]; rowData: any[] }>({
    columnDefs: [],
    rowData: [],
  });
  const [tabs, setTabs] = useState<string[]>(['All Codelists']);

  useEffect(() => {
    const handleFilenamesChange = () => {
      // setGridData(dataService.codelists_service.prepareAllCodelistsData());
      console.log(dataService.codelists_service._filenames, 'HANDLE FiLENAMES');
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
    setGridData(
      index === 0
        ? dataService.codelists_service.prepareAllCodelistsData()
        : dataService.codelists_service.prepareFileData(index)
    );
  };

  useEffect(() => {
    setGridData(dataService.codelists_service.prepareAllCodelistsData());
  }, []);

  const handleFileDrop = (files: FileList) => {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
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

  const infoContent = () => {
    return (
      <span>
        <i>Access codelists from CSV or Excel files.</i> Codelist files must :
        <ul>
          <li>contain one row per medical code</li>
          <li>
            a minimum of three columns :{' '}
            <ul>
              <li>
                <em>code</em> : the medical code such as 'E38.2'
              </li>
              <li>
                <em>code_type</em> : also known as known as 'ontology' or 'vocabulary', such as
                ICD10CM
              </li>
              <li>
                <em>codelist</em> : defines what entity the code in that row belongs to.
              </li>
            </ul>
          </li>
        </ul>
        To use these files with PhenEx :
        <ol>
          <li>
            <em>Upload a file</em> : <i>drag and drop a file into this panel</i>
          </li>
          <li>
            <em>Map necessary columns</em> : map the three columns defined above
          </li>
          <li>
            <em>Use the codelist entities</em> : codelists in the codelist column are available in the codelist column in
            any phenotype editing area.
          </li>
        </ol>
      </span>
    );
  };

  return (
    <FileDropZone onFileDrop={handleFileDrop}>
      <SlideoverPanel title="Codelists" info={infoContent()}>
        <div className={styles.container}>
          <div className={styles.tabsContainer}>
            <TabsWithDropdown
              width="auto"
              height="auto"
              tabs={tabs}
              active_tab_index={activeTab}
              onTabChange={handleTabChange}
            />
          </div>
          <div className={styles.bottomSection}>
            <div className={styles.infoBox}>
              {activeTab !== 0 && (
                <CodelistInfoAccordianTabbedInfoDisplay title={tabs[activeTab]} />
              )}
            </div>
            <div
              className={styles.tableBox}
              style={{ height: 'calc(100vh - 150px)', width: '100%' }}
            >
              <AgGridReact
                rowData={gridData.rowData}
                columnDefs={gridData.columnDefs}
                defaultColDef={{
                  sortable: true,
                  filter: true,
                  resizable: true,
                }}
                animateRows={true}
                theme={dataService.codelists_service.getTheme()}
              />
            </div>
          </div>
        </div>
      </SlideoverPanel>
    </FileDropZone>
  );
};
