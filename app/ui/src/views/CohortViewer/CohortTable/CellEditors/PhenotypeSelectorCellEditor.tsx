import React, { forwardRef } from 'react';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import { PhenotypeSelectorEditor } from './phenotypeSelectorEditor/PhenotypeSelectorEditor';

interface PhenotypeSelectorCellEditorProps extends PhenexCellEditorProps {
  // value is inherited from PhenexCellEditorProps
}

export const PhenotypeSelectorCellEditor = forwardRef<any, PhenotypeSelectorCellEditorProps>(
  (props, ref) => {
    const handleValueChange = (value: any) => {
      props.onValueChange?.(value);
    };

    return (
      <PhenexCellEditor {...props} ref={ref} autoCloseOnChange={true}>
        <PhenotypeSelectorEditor {...props} onValueChange={handleValueChange} />
      </PhenexCellEditor>
    );
  }
);

PhenotypeSelectorCellEditor.displayName = 'PhenotypeSelectorCellEditor';
