import React, { forwardRef } from 'react';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import styles from './DescriptionCellEditor.module.css';

interface DescriptionCellEditorProps extends PhenexCellEditorProps {
  value?: string;
}

export const DescriptionCellEditor = forwardRef<any, DescriptionCellEditorProps>((props, ref) => {
  const handleValueChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    props.onValueChange?.(event.target.value);
  };

  return (
    <PhenexCellEditor {...props} ref={ref}>
      <DescriptionEditor {...props} onValueChange={handleValueChange} />
    </PhenexCellEditor>
  );
});

DescriptionCellEditor.displayName = 'DescriptionCellEditor';

export interface DescriptionEditorProps {
  value?: any;
  onValueChange?: (value: any) => void;
}
export const DescriptionEditor: React.FC<DescriptionEditorProps> = props => {
  const [localValue, setLocalValue] = React.useState(
    typeof props.value === 'string' ? props.value : ''
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalValue(e.target.value);
  };

  const handleBlur = () => {
    props.onValueChange?.(localValue);
  };

  return (
    <textarea
      className={styles.textarea}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="Enter description..."
    />
  );
};
