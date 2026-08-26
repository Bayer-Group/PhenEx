import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import styles from './DescriptionCellEditor.module.css';

interface DescriptionCellEditorProps extends PhenexCellEditorProps {
  value?: string;
}

export const DescriptionCellEditor = forwardRef<any, DescriptionCellEditorProps>((props, ref) => {
  const editorRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    getValue: () => {
      return editorRef.current?.getValue() || props.value;
    },
    afterGuiAttached: () => {
      editorRef.current?.focus();
    }
  }));

  const handleValueChange = (value: string) => {
    props.onValueChange?.(value);
  };

  return (
    <PhenexCellEditor {...props} value={props.value || ''} ref={ref}>
      <DescriptionEditor 
        {...props} 
        onValueChange={handleValueChange}
        ref={editorRef}
      />
    </PhenexCellEditor>
  );
});

DescriptionCellEditor.displayName = 'DescriptionCellEditor';

export interface DescriptionEditorProps {
  value?: any;
  onValueChange?: (value: any) => void;
}

export const DescriptionEditor = forwardRef<any, DescriptionEditorProps>((props, ref) => {
  const [localValue, setLocalValue] = React.useState(
    typeof props.value === 'string' ? props.value : ''
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    getValue: () => localValue,
    focus: () => textareaRef.current?.focus()
  }));

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    // Call onValueChange immediately on every change
    props.onValueChange?.(newValue);
  };

  return (
    <textarea
      ref={textareaRef}
      className={styles.textarea}
      value={localValue}
      onChange={handleChange}
      placeholder="Enter description..."
    />
  );
});
