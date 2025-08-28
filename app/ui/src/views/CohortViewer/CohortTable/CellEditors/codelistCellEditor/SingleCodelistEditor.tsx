import React, { useState } from 'react';
import styles from './SingleCodelistEditor.module.css';
import { ManualCodelistEditor } from './ManualCodelistEditor';
import { FileCodelistEditor } from './FileCodelistEditor';
import { MedConBCodelistEditor } from './MedConBCodelistEditor';
import { Tabs } from '../../../../../components/ButtonsAndTabs/Tabs/Tabs';

export interface SingleCodelistEditorProps {
  value?: any;
  onValueChange?: (value: any) => void;
  options?: string[];
  className?: string;
}

type EditorType = 'manual' | 'from file' | 'from medconb';

const EDITOR_OPTIONS: { label: string; type: EditorType }[] = [
  { label: 'Manual', type: 'manual' },
  { label: 'File', type: 'from file' },
  { label: 'MedConB', type: 'from medconb' }
];

export const SingleCodelistEditor: React.FC<SingleCodelistEditorProps> = ({
  value,
  onValueChange,
  options,
  className,
}) => {
  const [selectedEditor, setSelectedEditor] = useState<EditorType>(
    value?.codelist_type || 'manual'
  );

  const handleTabChange = (tabIndex: number) => {
    const newEditorType = EDITOR_OPTIONS[tabIndex].type;
    setSelectedEditor(newEditorType);
  };

  const getCurrentTabIndex = () => {
    return EDITOR_OPTIONS.findIndex(option => option.type === selectedEditor);
  };

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
        <Tabs
          tabs={EDITOR_OPTIONS.map(option => option.label)}
          active_tab_index={getCurrentTabIndex()}
          onTabChange={handleTabChange}
        />
      </div>
      {renderEditor()}
    </div>
  );
};
