import React, { forwardRef } from 'react';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import styles from './DescriptionCellEditor.module.css';

interface DescriptionCellEditorProps extends PhenexCellEditorProps {
  value?: string;
}

export const DescriptionCellEditor = forwardRef<any, DescriptionCellEditorProps>(
  (props, ref) => {
    const handleValueChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      props.onValueChange?.(event.target.value);
    };

    return (
      <PhenexCellEditor {...props} ref={ref}>
        <textarea
          className={styles.textarea}
          value={props.value || ''}
          onChange={handleValueChange}
          placeholder="Enter description..."
          rows={4}
        />
      </PhenexCellEditor>
    );
  }
);

DescriptionCellEditor.displayName = 'DescriptionCellEditor';