import React, { useState } from 'react';
import styles from './SingleCodelistEditor.module.css';
import { ManualCodelistEditor } from './ManualCodelistEditor';
import { FileCodelistEditor } from './FileCodelistEditor';
import { MedConBCodelistEditor } from './MedConBCodelistEditor';

export interface SingleCodelistEditorProps {
  value?: any;
  onValueChange?: (value: any) => void;
  options?: string[];
  className?: string;
}

type EditorType = 'manual' | 'from file' | 'from medconb';

export const SingleCodelistEditor: React.FC<SingleCodelistEditorProps> = ({
  value,
  onValueChange,
  options,
  className,
}) => {
  const [selectedEditor, setSelectedEditor] = useState<EditorType>(
    value?.codelist_type || 'manual'
  );

  const handleValueChange = (newValue: any) => {
    console.log('SINGLE CODELIST EDITOR', newValue);
    newValue.codelist_type = selectedEditor;
    onValueChange?.(newValue);
  };

  const renderEditor = () => {
    const editorProps = { value, onValueChange, options };
    switch (selectedEditor) {
      case 'from file':
        return (
          <FileCodelistEditor
            {...editorProps}
            onValueChange={newValue => handleValueChange(newValue)}
          />
        );
      case 'from medconb':
        return (
          <MedConBCodelistEditor
            {...editorProps}
            onValueChange={newValue => handleValueChange(newValue)}
          />
        );
      default:
        return (
          <ManualCodelistEditor
            {...editorProps}
            onValueChange={newValue => handleValueChange(newValue)}
          />
        );
    }
  };

  return (
    <div className={`${styles.editorContainer} ${className || ''}`}>
      <div className={styles.editorTypeSelector}>
        <select
          value={selectedEditor}
          onChange={e => setSelectedEditor(e.target.value as EditorType)}
          className={styles.editorSelect}
        >
          <option value="manual">Manual</option>
          <option value="from file">From File</option>
          <option value="from medconb">From MedConB</option>
        </select>
      </div>
      {renderEditor()}
    </div>
  );
};
