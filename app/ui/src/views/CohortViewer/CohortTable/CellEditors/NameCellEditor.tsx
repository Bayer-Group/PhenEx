import React, { forwardRef, useState } from 'react';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import styles from './NameCellEditor.module.css';

/**
 * Cell editor for the phenotype name field.
 * Follows the DomainSelectorCellEditor pattern: thin wrapper around PhenexCellEditor
 * with a simple NameEditor child that reports changes via onValueChange.
 */
export const NameCellEditor = forwardRef<any, PhenexCellEditorProps>((props, ref) => {
  return (
    <PhenexCellEditor {...props} ref={ref}>
      <NameEditor {...props} />
    </PhenexCellEditor>
  );
});

NameCellEditor.displayName = 'NameCellEditor';

interface NameEditorProps {
  value?: any;
  onValueChange?: (value: any) => void;
}

const NameEditor: React.FC<NameEditorProps> = props => {
  const [localValue, setLocalValue] = useState<string>(
    typeof props.value === 'string' ? props.value : ''
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    props.onValueChange?.(newValue);
  };

  return (
    <textarea
      autoFocus
      className={styles.textarea}
      value={localValue}
      onChange={handleChange}
      placeholder="Enter name..."
    />
  );
};
