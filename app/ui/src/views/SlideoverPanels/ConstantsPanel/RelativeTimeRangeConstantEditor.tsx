/**
 * RelativeTimeRangeConstantEditor
 * 
 * Specialized editor for RelativeTimeRangeFilter constants.
 * Unlike the phenotype editor which handles arrays, this edits a single filter object.
 */

import React, { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { ICellEditorParams } from '@ag-grid-community/core';
import { PhenexCellEditor } from '../../CohortViewer/CohortTable/CellEditors/PhenexCellEditor';
import { SingleRelativeTimeRangeFilterEditor } from '../../CohortViewer/CohortTable/CellEditors/relativeTimeRangeFilterEditor/SingleRelativeTimeRangeFilterEditor';
import { TimeRangeFilter } from '../../CohortViewer/CohortTable/CellEditors/relativeTimeRangeFilterEditor/types';

interface RelativeTimeRangeConstantEditorProps extends ICellEditorParams {
  value: TimeRangeFilter;
  onValueChange?: (value: TimeRangeFilter) => void;
}

export const RelativeTimeRangeConstantEditor = forwardRef<any, RelativeTimeRangeConstantEditorProps>((props, ref) => {
  const [currentValue, setCurrentValue] = useState<TimeRangeFilter>(props.value || {
    class_name: 'RelativeTimeRangeFilter',
    min_days: { class_name: 'Value', operator: '>', value: 0 },
    max_days: { class_name: 'Value', operator: '<', value: 365 },
    when: 'before',
    useConstant: false,
    useIndexDate: true,
    anchor_phenotype: null,
  });

  const handleValueChange = (newValue: TimeRangeFilter) => {
    setCurrentValue(newValue);
    props.onValueChange?.(newValue);
  };

  useImperativeHandle(ref, () => ({
    getValue() {
      return currentValue;
    },
    isPopup() {
      return true;
    },
    getPopupPosition() {
      return 'under';
    },
  }));

  return (
    <PhenexCellEditor
      {...props}
      ref={ref}
      value={currentValue}
      fieldName="relative_time_range_filter"
      showComposerPanel={true}
      showAddButton={false}
      selectedItemIndex={undefined}
    >
      <SingleRelativeTimeRangeFilterEditor
        value={currentValue}
        onValueChange={handleValueChange}
      />
    </PhenexCellEditor>
  );
});

RelativeTimeRangeConstantEditor.displayName = 'RelativeTimeRangeConstantEditor';
