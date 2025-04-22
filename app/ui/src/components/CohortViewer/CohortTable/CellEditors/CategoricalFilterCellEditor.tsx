import React, { forwardRef } from 'react';
import { CategoricalFilterEditor } from './categoricalFilterEditor/CategoricalFilterEditor';
import { FilterType } from './categoricalFilterEditor/types';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';

interface CategoricalFilterCellEditorProps extends PhenexCellEditorProps {
  value?: FilterType;
}

export const CategoricalFilterCellEditor = forwardRef<any, CategoricalFilterCellEditorProps>(
  (props, ref) => {
    const handleValueChange = (value: FilterType) => {
      console.log("CATEGORICAL HANDLING VALUE CHANGE", props.onValueChange)
      props.onValueChange?.(value);
    };

    return (
      <PhenexCellEditor {...props} ref={ref}>
        <CategoricalFilterEditor {...props} onValueChange={handleValueChange} />
      </PhenexCellEditor>
    );
  }
);

CategoricalFilterCellEditor.displayName = 'CategoricalFilterCellEditor';
