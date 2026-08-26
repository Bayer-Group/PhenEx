import React, { forwardRef } from 'react';
import { PhenexCellEditor, PhenexCellEditorProps } from '../../CohortViewer/CohortTable/CellEditors/PhenexCellEditor';
import { ConstantTypeSelectorEditor } from './ConstantTypeSelectorEditor';

interface ConstantTypeSelectorCellEditorProps extends PhenexCellEditorProps {
  // value is inherited from PhenexCellEditorProps
}

export const ConstantTypeSelectorCellEditor = forwardRef<any, ConstantTypeSelectorCellEditorProps>(
  (props, ref) => {
    return (
      <PhenexCellEditor {...props} ref={ref} autoCloseOnChange={true}>
        <ConstantTypeSelectorEditor {...props} />
      </PhenexCellEditor>
    );
  }
);

ConstantTypeSelectorCellEditor.displayName = 'ConstantTypeSelectorCellEditor';
