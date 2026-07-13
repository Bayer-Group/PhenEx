import React, { useState, useEffect } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import { FileDropZone } from './FileDropZone/FileDropZone';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';
import { CodelistFilesTable } from './CodelistFilesTable';
import { InfoPanelUploadButton } from '../../../components/ButtonsAndTabs/InfoPanelButton/InfoPanelUploadButton';

interface CodelistsViewerProps {
  showTitle?: boolean;
}

export const CodelistsViewer: React.FC<CodelistsViewerProps> = ({ showTitle = true }) => {
  const [dataService] = useState(() => CohortDataService.getInstance());
  const [, forceUpdate] = useState(0);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  useEffect(() => {
    // Load codelists from backend on mount
    dataService.codelists_service.setFilenamesForCohort();

    // Listen for changes to force re-render (e.g. after file upload)
    const listener = () => forceUpdate(n => n + 1);
    dataService.codelists_service.addListener(listener);
    return () => {
      dataService.codelists_service.removeListener(listener);
    };
  }, [dataService]);

  const handleFileDrop = (files: FileList) => {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          const content = e.target?.result as string;
          await dataService.codelists_service.addFile({ filename: file.name, contents: content });
        } catch (error) {
          console.error('Error parsing file:', error);
        }
      };
      reader.readAsText(file);
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      handleFileDrop(files);
    }
  };

  const handleFileSelect = (fileId: string | null) => {
    setSelectedFileId(prev => prev === fileId ? null : fileId);
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
            <em>Use the codelist entities</em> : codelists in the codelist column are available in
            the codelist column in any phenotype editing area.
          </li>
        </ol>
      </span>
    );
  };

  const headerControls = (
    <InfoPanelUploadButton 
      tooltipText="Upload Codelist" 
      onFileSelect={handleFileUpload}
      accept=".csv"
      multiple={true}
    />
  );

  const renderPreviewTable = () => {
    if (!selectedFileId) return null;

    const fileData = dataService.codelists_service.prepareFileDataById(selectedFileId);
    if (!fileData) return null;

    return (
      <div style={{ height: 250, minHeight: 250, marginTop: 8, borderTop: '1px solid var(--line-color-grid, #e0e0e0)' }}>
        <AgGridReact
          rowData={fileData.rowData}
          columnDefs={fileData.columnDefs}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
          }}
          animateRows={true}
          headerHeight={28}
          theme={dataService.codelists_service.getTheme()}
        />
      </div>
    );
  };

  return (
    <FileDropZone onFileDrop={handleFileDrop}>
      <SlideoverPanel 
        title="Codelists" 
        info={infoContent()} 
        showTitle={showTitle}
        headerControls={headerControls}
      >
        <CodelistFilesTable onFileSelect={handleFileSelect} selectedFileId={selectedFileId} />
        {renderPreviewTable()}
      </SlideoverPanel>
    </FileDropZone>
  );
};
