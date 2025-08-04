import React, { forwardRef, useImperativeHandle } from 'react';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import { RelativeTimeRangeFilterEditor } from './relativeTimeRangeFilterEditor/RelativeTimeRangeFilterEditor';
import { TimeRangeFilter } from './relativeTimeRangeFilterEditor/types';

interface RelativeTimeRangeFilterCellEditorProps extends PhenexCellEditorProps {
  value?: TimeRangeFilter[];
  onValueChange?: (value: any) => void;
}

export const RelativeTimeRangeFilterCellEditor = forwardRef(
  (props: RelativeTimeRangeFilterCellEditorProps, ref) => {
    useImperativeHandle(ref, () => ({
      getValue() {
        return props.value;
      },
      isPopup() {
        return true;
      },
    }));
    return (
      <PhenexCellEditor {...props} ref={ref}>
        <RelativeTimeRangeFilterEditor {...props} />
      </PhenexCellEditor>
    );
  }
);

RelativeTimeRangeFilterCellEditor.displayName = 'RelativeTimeRangeFilterCellEditor';
