import React, { useState } from 'react';
import styles from './SingleCodelistEditor.module.css';
import { ManualCodelistEditor } from './ManualCodelistEditor';
import { FileCodelistEditor } from './FileCodelistEditor';
import { MedConBCodelistEditor } from './MedConBCodelistEditor';
import { Tabs } from '../../../../../components/ButtonsAndTabs/Tabs/Tabs';

export interface SingleCodelistEditorProps {
  value?: any;
  onValueChange?: (value: any) => void;
  onEditingDone?: () => void;
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
    // SingleCodelistEditor only works with a single codelist item
    // The child editors return their specific data structure
    // We wrap it in the proper Codelist object structure
    const updatedCodelist = {
      class_name: 'Codelist', // Always set
      codelist: newValue, // Wrap child editor data in codelist property
      codelist_type: selectedEditor,
      use_code_type: value?.use_code_type ?? true,
      remove_punctuation: value?.remove_punctuation ?? false,
    };
    onValueChange?.(updatedCodelist);
  };

  const renderEditor = () => {
    // Pass value.codelist to child editors (they work with the inner data)
    // SingleCodelistEditor manages the outer Codelist structure
    const editorProps = { 
      value: value?.codelist, // Extract the codelist data for child editors
      options 
    };
    
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
