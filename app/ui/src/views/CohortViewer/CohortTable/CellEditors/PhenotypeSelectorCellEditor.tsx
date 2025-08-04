import React, { forwardRef } from 'react';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import { PhenotypeSelectorEditor } from './phenotypeSelectorEditor/PhenotypeSelectorEditor';

interface PhenotypeSelectorCellEditorProps extends PhenexCellEditorProps {
  value?: any;
}

export const PhenotypeSelectorCellEditor = forwardRef<any, PhenotypeSelectorCellEditorProps>(
  (props, ref) => {
    const handleValueChange = (value: any) => {
      props.onValueChange?.(value);
    };

    return (
      <PhenexCellEditor {...props} ref={ref}>
        <PhenotypeSelectorEditor {...props} onValueChange={handleValueChange} />
      </PhenexCellEditor>
    );
  }
);

PhenotypeSelectorCellEditor.displayName = 'PhenotypeSelectorCellEditor';
