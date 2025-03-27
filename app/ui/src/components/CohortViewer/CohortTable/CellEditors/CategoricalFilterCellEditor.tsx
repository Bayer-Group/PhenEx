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
      if (typeof value === 'object' && value.status !== null && value.status !== 'empty') {
        props.onValueChange?.(value);
      } else {
        // return null if only a single unedited categorical filter
        props.onValueChange?.(null);
      }
    };

    return (
      <PhenexCellEditor {...props} ref={ref}>
        <CategoricalFilterEditor {...props} onValueChange={handleValueChange} />
      </PhenexCellEditor>
    );
  }
);

CategoricalFilterCellEditor.displayName = 'CategoricalFilterCellEditor';
