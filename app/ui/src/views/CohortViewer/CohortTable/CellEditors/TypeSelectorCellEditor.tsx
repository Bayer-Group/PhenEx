import React, { forwardRef } from 'react';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import { TypeSelectorEditor } from './typeSelectorEditor/TypeSelectorEditor';

interface TypeSelectorCellEditorProps extends PhenexCellEditorProps {
  // value is inherited from PhenexCellEditorProps
}

export const TypeSelectorCellEditor = forwardRef<any, TypeSelectorCellEditorProps>((props, ref) => {
  const handleValueChange = (value: any) => {
    props.onValueChange?.(value);
  };

  return (
    <PhenexCellEditor {...props} ref={ref} autoCloseOnChange={true}>
      <TypeSelectorEditor {...props} onValueChange={handleValueChange} />
    </PhenexCellEditor>
  );
});
