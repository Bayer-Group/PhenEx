import React, { forwardRef } from 'react';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import { ReturnDateEditor } from './returnDateEditor/ReturnDateEditor';

interface ReturnDateCellEditorProps extends PhenexCellEditorProps {
  // value is inherited from PhenexCellEditorProps
}

export const ReturnDateCellEditor = forwardRef<any, ReturnDateCellEditorProps>(
  (props, ref) => {
    return (
      <PhenexCellEditor {...props} ref={ref} autoCloseOnChange={true}>
        <ReturnDateEditor {...props} />
      </PhenexCellEditor>
    );
  }
);

ReturnDateCellEditor.displayName = 'ReturnDateCellEditor';
