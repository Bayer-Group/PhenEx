import React, { useState } from 'react';
import { SingleCodelistEditor } from './SingleCodelistEditor';
import styles from './CodelistsEditor.module.css';

interface CodelistsEditorProps {
  value?: any[];
  options?: string[];
  onValueChange?: (value: any[]) => void;
}

export const CodelistsEditor: React.FC<CodelistsEditorProps> = ({ value = [], options, onValueChange }) => {
  const [codelists, setCodelists] = useState(() => {
    console.log('Initial codelists value:', value);
    return Array.isArray(value) ? [...value] : [];
  });

  const handleValueChange = (index: number, newValue: any) => {
    console.log('CodelistsEditor handleValueChange triggered', index, newValue);
    if (Array.isArray(codelists)) {
      const updatedCodelists = [...codelists];
      updatedCodelists[index] = newValue;
      setCodelists(updatedCodelists);
      onValueChange?.(updatedCodelists);
    }
    else{
      setCodelists(newValue);
      onValueChange?.(newValue);
    }
   
  };

  const addNewCodelist = () => {
    if (Array.isArray(codelists)) {
      setCodelists([codelists[0], ...codelists]);
      return;
    }
    setCodelists([codelists, codelists]);
  };

  return (
    <div className={styles.container}>
      {Array.isArray(codelists) ? (
        codelists.map((value, index) => (
          <div key={index} className={styles.editorWrapper}>
            <SingleCodelistEditor
              value={value}
              options={options}
              onValueChange={(newValue) => handleValueChange(index, newValue)}
            />
          </div>
        ))
      ) : (
        <div className={styles.editorWrapper}>
          <SingleCodelistEditor
            value={codelists}
            options={options}
            onValueChange={(newValue) => handleValueChange(0, newValue)}
          />
        </div>
      )}
        <button className={styles.addButton} onClick={addNewCodelist}>Add Codelist</button>

    </div>
  );
};