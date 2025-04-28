import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import deepEqual from 'fast-deep-equal';
import styles from './ManualCodelistEditor.module.css';

interface ManualCodelistEditorProps {
  value?: any;
  onValueChange?: (value: any) => void;
}

export const ManualCodelistEditor: React.FC<ManualCodelistEditorProps> = ({ value, onValueChange }) => {
  const [useCodeType, setUseCodeType] = useState(() => {
    if (value && typeof value === 'object') {
      return value.use_code_type ?? true;
    }
    return true;
  });

  const [removePunctuation, setRemovePunctuation] = useState(() => {
    if (value && typeof value === 'object') {
      return value.remove_punctuation ?? false;
    }
    return false;
  });

  const [manualEntries, setManualEntries] = useState(() => {
    if (!value) {
      return [{ codeType: '', codes: '' }];
    }
    if (value.codelist && typeof value === 'object') {
      return Object.entries(value.codelist).map(([codeType, codes]) => ({
        codeType,
        codes: Array.isArray(codes) ? codes.join(', ') : '',
      }));
    }
    return [{ codeType: '', codes: '' }];
  });

  const formatEntries = useCallback((entries) => {
    return entries.reduce(
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
  }, []);

  const formattedValue = useMemo(() => ({
    class_name: 'Codelist',
    codelist: formatEntries(manualEntries),
    use_code_type: useCodeType,
    remove_punctuation: removePunctuation,
  }), [
    JSON.stringify(manualEntries),
    useCodeType,
    removePunctuation,
    formatEntries
  ]);

  const prevFormattedValue = useRef(formattedValue);
  useEffect(() => {
    if (onValueChange && !deepEqual(formattedValue, prevFormattedValue.current)) {
      onValueChange(formattedValue);
      prevFormattedValue.current = formattedValue;
    }
  }, [formattedValue, onValueChange]);

  const handleManualEntryChange = (newEntries: typeof manualEntries) => {
    setManualEntries(newEntries);
    console.log("MANUAL CODELIST : ", newEntries)
    if (onValueChange) {
      onValueChange(formattedValue);
    }
  };

  return (
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
                newEntries[index] = { ...newEntries[index], codeType: e.target.value };
                handleManualEntryChange(newEntries);
              }}
              className={styles.codeTypeInput}
              placeholder="Code type"
            />
          </div>
          <div className={styles.codesField}>
            <label>Codes</label>
            <textarea
              value={entry.codes}
              onChange={e => {
                const newEntries = [...manualEntries];
                newEntries[index] = { ...newEntries[index], codes: e.target.value };
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
  );
};