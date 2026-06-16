import React, { forwardRef } from 'react';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import { PhenotypeSelectorEditor } from './phenotypeSelectorEditor/PhenotypeSelectorEditor';

interface PhenotypeSelectorCellEditorProps extends PhenexCellEditorProps {
  // value is inherited from PhenexCellEditorProps
}

export const PhenotypeSelectorCellEditor = forwardRef<any, PhenotypeSelectorCellEditorProps>(
  (props, ref) => {
    return (
      <PhenexCellEditor {...props} ref={ref} autoCloseOnChange={true}>
        <PhenotypeSelectorEditor {...props} />
      </PhenexCellEditor>
    );
  }
);

PhenotypeSelectorCellEditor.displayName = 'PhenotypeSelectorCellEditor';
