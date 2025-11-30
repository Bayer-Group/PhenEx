import React, { forwardRef } from 'react';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import { DomainSelectorEditor } from './domainSelectorEditor/DomainSelectorEditor';

interface DomainSelectorCellEditorProps extends PhenexCellEditorProps {
  // value is inherited from PhenexCellEditorProps
}

export const DomainSelectorCellEditor = forwardRef<any, DomainSelectorCellEditorProps>(
  (props, ref) => {
    const handleValueChange = (value: any) => {
      props.onValueChange?.(value);
    };

    return (
      <PhenexCellEditor {...props} ref={ref} autoCloseOnChange={true}>
        <DomainSelectorEditor {...props} onValueChange={handleValueChange} />
      </PhenexCellEditor>
    );
  }
);

DomainSelectorCellEditor.displayName = 'DomainSelectorCellEditor';
