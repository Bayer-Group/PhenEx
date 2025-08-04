import React, { forwardRef, useImperativeHandle } from 'react';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import { ValueFilterEditor } from './valueFilterEditor/ValueFilterEditor';
import { ValueFilter } from './valueFilterEditor/types';

interface ValueFilterCellEditorProps extends PhenexCellEditorProps {
  value?: ValueFilter[];
  onValueChange?: (value: any) => void;
}

export const ValueFilterCellEditor = forwardRef((props: ValueFilterCellEditorProps, ref) => {
  useImperativeHandle(ref, () => ({
    getValue() {
      return props.value;
    },
    isPopup() {
      return true;
    },
  }));

  const filterPhenotypes = ['MeasurementPhenotype', 'AgePhenotype'];
  if (!filterPhenotypes.includes(props.data.class_name)) {
    return <div></div>;
  }

  console.log('VALUE CELL EDITOR', props);
  return (
    <PhenexCellEditor {...props} ref={ref}>
      <ValueFilterEditor {...props} />
    </PhenexCellEditor>
  );
});

ValueFilterCellEditor.displayName = 'ValueFilterCellEditor';
