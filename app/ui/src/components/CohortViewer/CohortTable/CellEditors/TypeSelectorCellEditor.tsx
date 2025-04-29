import React, { forwardRef } from 'react';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import { TypeSelectorEditor } from './typeSelectorEditor/TypeSelectorEditor';

interface TypeSelectorCellEditorProps extends PhenexCellEditorProps {
  value?: any;
}

export const TypeSelectorCellEditor = forwardRef<any, TypeSelectorCellEditorProps>(
  (props, ref) => {
    const handleValueChange = (value: any) => {
      props.onValueChange?.(value);
    };

    return (
      <PhenexCellEditor {...props} ref={ref}>
        <TypeSelectorEditor {...props} onValueChange={handleValueChange} />
      </PhenexCellEditor>
    );
  }
);