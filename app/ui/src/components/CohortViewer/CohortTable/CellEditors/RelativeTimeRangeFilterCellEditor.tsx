import React, { forwardRef, useImperativeHandle } from 'react';
import { ICellEditorParams } from '@ag-grid-community/core';
import { RelativeTimeRangeFilterEditor } from './relativeTimeRangeFilterEditor/RelativeTimeRangeFilterEditor';
import { TimeRangeFilter } from './relativeTimeRangeFilterEditor/types';

interface RelativeTimeRangeFilterCellEditorProps extends ICellEditorParams {
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

    return <RelativeTimeRangeFilterEditor {...props} />;
  }
);

RelativeTimeRangeFilterCellEditor.displayName = 'RelativeTimeRangeFilterCellEditor';
