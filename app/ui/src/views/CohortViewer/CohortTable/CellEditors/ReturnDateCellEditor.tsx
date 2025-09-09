import React, { forwardRef } from 'react';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import { ReturnDateEditor } from './returnDateEditor/ReturnDateEditor';

interface ReturnDateCellEditorProps extends PhenexCellEditorProps {
  value?: any;
}

export const ReturnDateCellEditor = forwardRef<any, ReturnDateCellEditorProps>(
  (props, ref) => {
    const handleValueChange = (value: any) => {
      props.onValueChange?.(value);
    };

    return (
      <PhenexCellEditor {...props} ref={ref}>
        <ReturnDateEditor {...props} onValueChange={handleValueChange} />
      </PhenexCellEditor>
    );
  }
);

ReturnDateCellEditor.displayName = 'ReturnDateCellEditor';
