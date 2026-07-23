import React, { forwardRef } from 'react';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import { TypeSelectorEditor } from './typeSelectorEditor/TypeSelectorEditor';

interface TypeSelectorCellEditorProps extends PhenexCellEditorProps {
  // value is inherited from PhenexCellEditorProps
}

export const TypeSelectorCellEditor = forwardRef<any, TypeSelectorCellEditorProps>((props, ref) => {
  return (
    <PhenexCellEditor {...props} ref={ref} autoCloseOnChange={true}>
      <TypeSelectorEditor {...props} />
    </PhenexCellEditor>
  );
});
