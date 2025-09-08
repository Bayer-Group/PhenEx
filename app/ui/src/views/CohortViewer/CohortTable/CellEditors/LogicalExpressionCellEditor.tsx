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
    console.log("THE LOGCIAL EDITOR", props)
    return (
      <PhenexCellEditor {...props} ref={ref}>
        <LogicalExpressionEditor {...props} onValueChange={handleValueChange} phenotype={props.data}/>
      </PhenexCellEditor>
    );
  }
);

LogicalExpressionCellEditor.displayName = 'LogicalExpressionCellEditor';
