import React, { useState, useEffect } from 'react';
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
    const codelistFilenames = cohortDataService.codelists_service._filenames || [];
    setFilenames(codelistFilenames);
    
    if (initialValue) {
      setSelectedFileName(initialValue.file_name || '');
      setSelectedCodeColumn(initialValue.code_column || '');
      setSelectedCodeTypeColumn(initialValue.code_type_column || '');
      setSelectedCodelistColumn(initialValue.codelist_column || '');
      setSelectedCodelist(initialValue.codelist_name || '');
    }
    if (codelistFilenames.length > 0) {
      console.log("there are codelists", codelistFilenames)
      setSelectedFileName(codelistFilenames[0]);
      setSelectedFileColumnnames(cohortDataService.codelists_service.getColumnsForFile(codelistFilenames[0]) || []);
    }
    console.log("SETT THE INITILA VAlUES", selectedFileColumnnames)
  }, []);

  useEffect(() => {
    setSelectedFileColumnnames(cohortDataService.codelists_service.getColumnsForFile(selectedFileName) || []);
    
    setSelectedCodeColumn(cohortDataService.codelists_service.getDefaultColumnForFile(selectedFileName, 'code_column') || '');
    
    setSelectedCodeTypeColumn(cohortDataService.codelists_service.getDefaultColumnForFile(selectedFileName, 'code_type_column') || '');
    
    setSelectedCodelistColumn(cohortDataService.codelists_service.getDefaultColumnForFile(selectedFileName, 'codelist_column') || '');
  }, [selectedFileName]);

  useEffect(() => {
    if (selectedFileName && selectedCodelistColumn) {
      const codelists = cohortDataService.codelists_service.getCodelistsForFileInColumn(selectedFileName, selectedCodelistColumn) || [];
      setSelectedFileCodelists(codelists);
      if (codelists.length > 0 && !selectedCodelist) {
        setSelectedCodelist(codelists[0]);
      }
    }
    console.log("SETTING codelsits")
  }, [selectedFileName, selectedCodelistColumn]);

  const handleDropdownChange = (field: string, value: string) => {
    console.log(" DROPDOWN CHANGED", field, value)
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
        file_id: cohortDataService.codelists_service.getFileIdForName(field === 'fileName' ? value : selectedFileName) || null,
        code_column: field === 'codeColumn' ? value : selectedCodeColumn,
        code_type_column: field === 'codeTypeColumn' ? value : selectedCodeTypeColumn,
        codelist_column: field === 'codelistColumn' ? value : selectedCodelistColumn,
        codelist_name: field === 'codelist' ? value : selectedCodelist,
        cohort_id: cohortDataService.cohort_data.id
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
    selectedFileCodelists
  };
};

export const FileCodelistEditor: React.FC<FileCodelistEditorProps> = ({ value, onValueChange }) => {
  const {
    selectedFileName,
    selectedFileColumnnames,
    selectedCodeColumn,
    selectedCodeTypeColumn,
    selectedCodelistColumn,
    filenames,
    handleDropdownChange,
    selectedCodelist,
    selectedFileCodelists
  } = useCodelistState(value, onValueChange);




  return (
    <>
      <div className={styles.tabContent}>

      </div>
      <div className={styles.dropdownGroup}>
      <label>File Name:</label>
      <select 
        value={selectedFileName} 
        onChange={(e) => handleDropdownChange('fileName', e.target.value)}
      >
        {filenames.map((file, index) => (
          <option key={index} value={file}>{file}</option>
        ))}
      </select>
    </div>

    <div className={styles.dropdownGroup}>
      <label>Code Column:</label>
      <select
        value={selectedCodeColumn}
        onChange={(e) => handleDropdownChange('codeColumn', e.target.value)}
      >
        {selectedFileColumnnames.map((col, index) => (
          <option key={index} value={col}>{col}</option>
        ))}
      </select>
    </div>

    <div className={styles.dropdownGroup}>
      <label>Code Type Column:</label>
      <select
        value={selectedCodeTypeColumn}
        onChange={(e) => handleDropdownChange('codeTypeColumn', e.target.value)}
      >
        {selectedFileColumnnames.map((col, index) => (
          <option key={index} value={col}>{col}</option>
        ))}
      </select>
    </div>

    <div className={styles.dropdownGroup}>
      <label>Codelist Column:</label>
      <select
        value={selectedCodelistColumn}
        onChange={(e) => handleDropdownChange('codelistColumn', e.target.value)}
      >
        {selectedFileColumnnames.map((col, index) => (
          <option key={index} value={col}>{col}</option>
        ))}
      </select>
    </div>

    <div className={styles.dropdownGroup}>
      <label>Codelist:</label>
      <select
        value={selectedCodelist}
        onChange={(e) => handleDropdownChange('codelist', e.target.value)}
      >
        {selectedFileCodelists.map((codelist, index) => (
          <option key={index} value={codelist}>{codelist}</option>
        ))}
      </select>
    </div>
    </>
  );
};