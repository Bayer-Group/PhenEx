import React, { useState, useEffect } from 'react';
import { ICellEditorParams } from '@ag-grid-community/core';
import styles from './CodelistCellEditor.module.css';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import { CodelistsEditor } from './codelistCellEditor/CodelistsEditor';

interface CodelistCellEditorProps extends PhenexCellEditorProps {
  options?: string[];
}

export const CodelistCellEditor = React.forwardRef<any, CodelistCellEditorProps>((props, ref) => {
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

  const handleValueChange = (newValue: any) => {
    if (props.onValueChange) {
      props.onValueChange({
        ...newValue,
        class_name: 'Codelist',
        use_code_type: useCodeType,
        remove_punctuation: removePunctuation,
      });
    }
  };

CodelistCellEditor.displayName = 'CodelistCellEditor';

  return (
    <PhenexCellEditor {...props} ref={ref}>
      <CodelistsEditor
        value={props.value}
        options={props.options}
        onValueChange={handleValueChange}
        className={styles.editorContainer}
      />
        {/* <div className={styles.chin}>
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
        </div> */}
    </PhenexCellEditor>
  );
});

CodelistCellEditor.displayName = 'CodelistCellEditor';
