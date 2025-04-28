import React, { forwardRef } from 'react';
import { LogicalExpressionEditor } from './logicalExpressionEditor/LogicalExpressionEditor';
import { FilterType } from './logicalExpressionEditor/types';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';

interface LogicalExpressionCellEditorProps extends PhenexCellEditorProps {
  value?: FilterType;
}

export const LogicalExpressionCellEditor = forwardRef<any, LogicalExpressionCellEditorProps>(
  (props, ref) => {
    const handleValueChange = (value: FilterType) => {
      props.onValueChange?.(value);
    };

    return (
      <PhenexCellEditor {...props} ref={ref}>
        <LogicalExpressionEditor {...props} onValueChange={handleValueChange} />
      </PhenexCellEditor>
    );
  }
);

LogicalExpressionCellEditor.displayName = 'LogicalExpressionCellEditor';