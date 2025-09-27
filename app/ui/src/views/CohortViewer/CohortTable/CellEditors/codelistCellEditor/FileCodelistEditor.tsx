import React, { useState, useEffect, useRef } from 'react';
import styles from '../CodelistCellEditor.module.css';
import { CohortDataService } from '../../../CohortDataService/CohortDataService';

interface FileCodelistEditorProps {
  value?: any;
  onValueChange?: (value: any) => void;
}

const useCodelistState = (initialValue: any, onValueChange?: (value: any) => void) => {
  const [cohortDataService] = useState(() => CohortDataService.getInstance());
  const [selectedFileName, setSelectedFileName] = useState('');
  const [selectedFileColumnnames, setSelectedFileColumnnames] = useState<string[]>([]);
  const [selectedCodeColumn, setSelectedCodeColumn] = useState('');
  const [selectedCodeTypeColumn, setSelectedCodeTypeColumn] = useState('');
  const [selectedCodelistColumn, setSelectedCodelistColumn] = useState('');
  const [selectedCodelist, setSelectedCodelist] = useState('');
  const [selectedFileCodelists, setSelectedFileCodelists] = useState<string[]>([]);
  const [filenames, setFilenames] = useState<string[]>([]);

  useEffect(() => {
    const loadFilenamesAndFiles = async () => {
      // Make sure we have the filenames and files loaded
      await cohortDataService.codelists_service.setFilenamesForCohort();
      
      const codelistFilenames = cohortDataService.codelists_service._filenames || [];
      console.log('FileCodelistEditor: loaded filenames:', codelistFilenames);
      console.log('FileCodelistEditor: loaded files:', cohortDataService.codelists_service.files);
      
      setFilenames(codelistFilenames);

      if (initialValue) {
        setSelectedFileName(initialValue.file_name || '');
        setSelectedCodeColumn(initialValue.code_column || '');
        setSelectedCodeTypeColumn(initialValue.code_type_column || '');
        setSelectedCodelistColumn(initialValue.codelist_column || '');
        setSelectedCodelist(initialValue.codelist_name || '');
      }
      if (codelistFilenames.length > 0) {
        console.log('FileCodelistEditor: setting first filename as default');
        const firstFileName = codelistFilenames[0];
        setSelectedFileName(firstFileName);
        
        const columns = cohortDataService.codelists_service.getColumnsForFile(firstFileName) || [];
        console.log('FileCodelistEditor: columns for first file:', columns);
        setSelectedFileColumnnames(columns);
      }
    };
    
    loadFilenamesAndFiles();
  }, []);

  useEffect(() => {
    console.log('FileCodelistEditor: selectedFileName changed:', selectedFileName);
    
    if (!selectedFileName) {
      console.log('FileCodelistEditor: No selectedFileName, skipping column setup');
      return;
    }
    
    const columns = cohortDataService.codelists_service.getColumnsForFile(selectedFileName) || [];
    console.log('FileCodelistEditor: columns for file:', selectedFileName, columns);
    setSelectedFileColumnnames(columns);

    const codeColumn = cohortDataService.codelists_service.getDefaultColumnForFile(
      selectedFileName,
      'code_column'
    ) || '';
    console.log('FileCodelistEditor: default code_column:', codeColumn);
    setSelectedCodeColumn(codeColumn);

    const codeTypeColumn = cohortDataService.codelists_service.getDefaultColumnForFile(
      selectedFileName,
      'code_type_column'
    ) || '';
    console.log('FileCodelistEditor: default code_type_column:', codeTypeColumn);
    setSelectedCodeTypeColumn(codeTypeColumn);

    const codelistColumn = cohortDataService.codelists_service.getDefaultColumnForFile(
      selectedFileName,
      'codelist_column'
    ) || '';
    console.log('FileCodelistEditor: default codelist_column:', codelistColumn);
    setSelectedCodelistColumn(codelistColumn);
  }, [selectedFileName]);

  useEffect(() => {
    if (selectedFileName && selectedCodelistColumn) {
      console.log('FileCodelistEditor: Getting codelists for file:', selectedFileName, 'column:', selectedCodelistColumn);
      
      const codelists =
        cohortDataService.codelists_service.getCodelistsForFileInColumn(
          selectedFileName,
          selectedCodelistColumn
        ) || [];
        
      console.log('FileCodelistEditor: Found codelists:', codelists);
      setSelectedFileCodelists(codelists);
      
      if (codelists.length > 0 && !selectedCodelist) {
        console.log('FileCodelistEditor: Setting first codelist as default:', codelists[0]);
        setSelectedCodelist(codelists[0]);
      }
    }
  }, [selectedFileName, selectedCodelistColumn]);

  const handleDropdownChange = (field: string, value: string) => {
    console.log(' DROPDOWN CHANGED', field, value);
    switch (field) {
      case 'fileName':
        setSelectedFileName(value);
        break;
      case 'codeColumn':
        setSelectedCodeColumn(value);
        break;
      case 'codeTypeColumn':
        setSelectedCodeTypeColumn(value);
        break;
      case 'codelistColumn':
        setSelectedCodelistColumn(value);
        break;
      case 'codelist':
        setSelectedCodelist(value);
        break;
    }

    if (onValueChange) {
      onValueChange({
        file_name: field === 'fileName' ? value : selectedFileName,
        file_id:
          cohortDataService.codelists_service.getFileIdForName(
            field === 'fileName' ? value : selectedFileName
          ) || null,
        code_column: field === 'codeColumn' ? value : selectedCodeColumn,
        code_type_column: field === 'codeTypeColumn' ? value : selectedCodeTypeColumn,
        codelist_column: field === 'codelistColumn' ? value : selectedCodelistColumn,
        codelist_name: field === 'codelist' ? value : selectedCodelist,
        cohort_id: cohortDataService.cohort_data.id,
      });
    }
  };

  return {
    selectedFileName,
    selectedFileColumnnames,
    selectedCodeColumn,
    selectedCodeTypeColumn,
    selectedCodelistColumn,
    filenames,
    handleDropdownChange,
    selectedCodelist,
    selectedFileCodelists,
  };
};

export const FileCodelistEditor: React.FC<FileCodelistEditorProps> = ({ value, onValueChange }) => {
  const [showMore, setShowMore] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>(0);
  
  const {
    selectedFileName,
    selectedFileColumnnames,
    selectedCodeColumn,
    selectedCodeTypeColumn,
    selectedCodelistColumn,
    filenames,
    handleDropdownChange,
    selectedCodelist,
    selectedFileCodelists,
  } = useCodelistState(value, onValueChange);

  useEffect(() => {
    if (contentRef.current) {
      const contentHeight = contentRef.current.scrollHeight;
      setHeight(showMore ? contentHeight : 0);
    }
  }, [showMore]);

  return (
    <>
      <div className={styles.tabContent}></div>
      <div className={styles.dropdownGroup}>
        <label>File Name:</label>
        <select
          value={selectedFileName}
          onChange={e => handleDropdownChange('fileName', e.target.value)}
        >
          {filenames.map((file, index) => (
            <option key={index} value={file}>
              {file}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.dropdownGroup}>
            <label>Codelist:</label>
            <select
              value={selectedCodelist}
              onChange={e => handleDropdownChange('codelist', e.target.value)}
            >
              {selectedFileCodelists.map((codelist, index) => (
                <option key={index} value={codelist}>
                  {codelist}
                </option>
              ))}
            </select>
          </div>
      <div className={styles.dropdownGroup}>
        <button 
          type="button"
          className={styles.moreButton}
          onClick={() => setShowMore(!showMore)}
        >
          {showMore ? 'Less' : 'More'}
        </button>
      </div>

      <div 
        className={styles.additionalFieldsContainer}
        style={{ 
          height: `${height}px`,
          overflow: 'hidden',
          transition: 'height 0.3s ease-in-out'
        }}
      >
        <div ref={contentRef} className={styles.additionalFields}>
          <div className={styles.dropdownGroup}>
            <label>Code Column:</label>
            <select
              value={selectedCodeColumn}
              onChange={e => handleDropdownChange('codeColumn', e.target.value)}
            >
              {selectedFileColumnnames.map((col, index) => (
                <option key={index} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.dropdownGroup}>
            <label>Code Type Column:</label>
            <select
              value={selectedCodeTypeColumn}
              onChange={e => handleDropdownChange('codeTypeColumn', e.target.value)}
            >
              {selectedFileColumnnames.map((col, index) => (
                <option key={index} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.dropdownGroup}>
            <label>Codelist Column:</label>
            <select
              value={selectedCodelistColumn}
              onChange={e => handleDropdownChange('codelistColumn', e.target.value)}
            >
              {selectedFileColumnnames.map((col, index) => (
                <option key={index} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </>
  );
};
