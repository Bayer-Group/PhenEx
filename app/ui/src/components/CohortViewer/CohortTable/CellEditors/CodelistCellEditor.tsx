import React, { useState, useEffect } from 'react';
import { ICellEditorParams } from '@ag-grid-community/core';
import styles from './CodelistCellEditor.module.css';
import { TabbedCellEditor, TabConfig, TabbedCellEditorProps } from './TabbedCellEditor';

interface CodelistCellEditorProps extends TabbedCellEditorProps {
  options?: string[];
}

export const CodelistCellEditor = (props: CodelistCellEditorProps) => {
  const [searchValue, setSearchValue] = useState('');
  const [selectedValue, setSelectedValue] = useState('');
  const [useCodeType, setUseCodeType] = useState(() => {
    if (props.value && typeof props.value === 'object') {
      return props.value.use_code_type ?? true;
    }
    return true;
  });
  const [removePunctuation, setRemovePunctuation] = useState(() => {
    if (props.value && typeof props.value === 'object') {
      return props.value.remove_punctuation ?? false;
    }
    return false;
  });
  const [manualEntries, setManualEntries] = useState(() => {
    if (!props.value) {
      return [{ codeType: '', codes: '' }];
    }
    if (props.value.codelist && typeof props.value === 'object') {
      return Object.entries(props.value.codelist).map(([codeType, codes]) => ({
        codeType,
        codes: Array.isArray(codes) ? codes.join(', ') : '',
      }));
    }
    return [{ codeType: '', codes: '' }];
  });

  const options = props.options || [];
  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchValue.toLowerCase())
  );

  useEffect(() => {
    const formattedEntries = manualEntries.reduce(
      (acc, entry) => {
        if (entry.codeType && entry.codes) {
          acc[entry.codeType] = entry.codes
            .split(',')
            .map(code => code.trim())
            .filter(code => code.length > 0);
        }
        return acc;
      },
      {} as { [key: string]: string[] }
    );
    console.log('CURRENT STATE', useCodeType, removePunctuation);
    if (props.onValueChange) {
      props.onValueChange({
        class_name: 'Codelist',
        codelist: formattedEntries,
        use_code_type: useCodeType,
        remove_punctuation: removePunctuation,
      });
    }
  }, [manualEntries, useCodeType, removePunctuation]);

  const handleOptionClick = (option: string) => {
    setSelectedValue(option);
    setSearchValue(option);
    if (props.api) {
      props.api.stopEditing();
    }
  };

  const handleManualEntryChange = (newEntries: typeof manualEntries) => {
    setManualEntries(newEntries);
  };

  const tabs: TabConfig[] = [
    {
      id: 'manual',
      label: 'Manual',
      content: (
        <div className={styles.tabContent}>
          {manualEntries.map((entry, index) => (
            <div key={index} className={styles.manualEntryRow}>
              <div className={styles.codeTypeField}>
                <label>Code Type</label>
                <input
                  type="text"
                  value={entry.codeType}
                  onChange={e => {
                    const newEntries = [...manualEntries];
                    newEntries[index].codeType = e.target.value;
                    handleManualEntryChange(newEntries);
                  }}
                  className={styles.searchInput}
                  placeholder="Code type"
                />
              </div>
              <div className={styles.codesField}>
                <label>Codes</label>
                <textarea
                  value={entry.codes}
                  onChange={e => {
                    const newEntries = [...manualEntries];
                    newEntries[index].codes = e.target.value;
                    handleManualEntryChange(newEntries);
                  }}
                  className={styles.codesTextarea}
                  placeholder="Enter codes separated by commas"
                />
              </div>
              <button
                className={styles.deleteButton}
                onClick={() => {
                  const newEntries = manualEntries.filter((_, i) => i !== index);
                  handleManualEntryChange(
                    newEntries.length ? newEntries : [{ codeType: '', codes: '' }]
                  );
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            className={styles.addButton}
            onClick={() => handleManualEntryChange([...manualEntries, { codeType: '', codes: '' }])}
          >
            +
          </button>
        </div>
      ),
    },
    {
      id: 'codelist',
      label: 'Codelist',
      content: (
        <div className={styles.tabContent}>
          <input
            type="text"
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            className={styles.searchInput}
            placeholder="Search codes..."
          />
          <div className={styles.optionsList}>
            {filteredOptions.map((option, index) => (
              <div
                key={index}
                className={`${styles.option} ${option === selectedValue ? styles.selected : ''}`}
                onClick={() => handleOptionClick(option)}
              >
                {option}
              </div>
            ))}
            {filteredOptions.length === 0 && (
              <div className={styles.noResults}>No matching codes found</div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'medconb',
      label: 'MedConB',
      content: (
        <div className={styles.tabContent}>
          <div className={styles.optionsList}>
            <div className={styles.noResults}>MedConB options coming soon</div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.editorContainer}>
      <TabbedCellEditor {...props} tabs={tabs} />
      <div className={styles.chin}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={useCodeType}
            onChange={e => setUseCodeType(e.target.checked)}
          />
          use_code_type
        </label>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={removePunctuation}
            onChange={e => setRemovePunctuation(e.target.checked)}
          />
          remove_punctuation
        </label>
      </div>
    </div>
  );
};

CodelistCellEditor.displayName = 'CodelistCellEditor';
