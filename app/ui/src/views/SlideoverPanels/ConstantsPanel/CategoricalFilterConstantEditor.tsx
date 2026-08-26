/**
 * CategoricalFilterConstantEditor
 * 
 * Specialized editor for CategoricalFilter constants.
 * Unlike the phenotype editor which handles logical trees, this edits a single filter object.
 */

import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { ICellEditorParams } from '@ag-grid-community/core';
import { PhenexCellEditor } from '../../CohortViewer/CohortTable/CellEditors/PhenexCellEditor';
import { SimplifiedSingleCategoricalFilterEditor } from '../../CohortViewer/CohortTable/CellEditors/categoricalFilterEditor/SimplifiedSingleCategoricalFilterEditor';

interface CategoricalFilterValue {
  class_name: 'CategoricalFilter';
  column_name: string;
  operator: 'isin' | 'notin' | 'isnull' | 'notnull';
  allowed_values: string[];
  domain?: string;
  useConstant?: boolean;
  constant?: string | null;
}

interface CategoricalFilterConstantEditorProps extends ICellEditorParams {
  value: CategoricalFilterValue;
  onValueChange?: (value: CategoricalFilterValue) => void;
}

export const CategoricalFilterConstantEditor = forwardRef<any, CategoricalFilterConstantEditorProps>((props, ref) => {
  const [currentValue, setCurrentValue] = useState<CategoricalFilterValue>(props.value || {
    class_name: 'CategoricalFilter',
    column_name: '',
    operator: 'isin',
    allowed_values: [],
    useConstant: false,
  });

  const handleValueChange = (newValue: CategoricalFilterValue) => {
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
      fieldName="categorical_filter"
      showComposerPanel={true}
      showAddButton={false}
      selectedItemIndex={undefined}
    >
      <SimplifiedSingleCategoricalFilterEditor
        value={currentValue}
        onValueChange={handleValueChange}
      />
    </PhenexCellEditor>
  );
});

CategoricalFilterConstantEditor.displayName = 'CategoricalFilterConstantEditor';
