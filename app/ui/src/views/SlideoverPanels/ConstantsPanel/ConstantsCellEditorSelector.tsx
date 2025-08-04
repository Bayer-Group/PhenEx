/*
This is an almost identical clone of PhenexPhenotypeCellEditor
Duplication required because the keys are not phenotype parameters but rather the type which is a phenex class name
*/
import React, { forwardRef, useImperativeHandle } from 'react';
import { RelativeTimeRangeFilterCellEditor } from '../../CohortViewer/CohortTable/CellEditors/RelativeTimeRangeFilterCellEditor';
import { CategoricalFilterCellEditor } from '../../CohortViewer/CohortTable/CellEditors/CategoricalFilterCellEditor';
import { CodelistCellEditor } from '../../CohortViewer/CohortTable/CellEditors/CodelistCellEditor';
import { ValueFilterCellEditor } from '../../CohortViewer/CohortTable/CellEditors/ValueFilterCellEditor';
import { PhenotypeSelectorCellEditor } from '../../CohortViewer/CohortTable/CellEditors/PhenotypeSelectorCellEditor';

import { DomainSelectorCellEditor } from '../../CohortViewer/CohortTable/CellEditors/DomainSelectorCellEditor';
import { LogicalExpressionCellEditor } from '../../CohortViewer/CohortTable/CellEditors/LogicalExpressionCellEditor';
import { DescriptionCellEditor } from '../../CohortViewer/CohortTable/CellEditors/DescriptionCellEditor';
import { TypeSelectorCellEditor } from '../../CohortViewer/CohortTable/CellEditors/TypeSelectorCellEditor';

export interface ConstantsCellEditorSelectorProps extends ICellEditorParams {
  value?: any;
  onValueChange?: (value: any) => void;
}

const classNameToEditorMapping = {
  RelativeTimeRangeFilter: RelativeTimeRangeFilterCellEditor,
  CategoricalFilter: CategoricalFilterCellEditor,
  Codelist: CodelistCellEditor,
  ValueFilter: ValueFilterCellEditor,
};

export const ConstantsCellEditorSelector = forwardRef(
  (props: ConstantsCellEditorSelectorProps, ref) => {
    console.log(props);
    console.log('THIS IS CELL EDITOR CONSTANTs');
    if (props.data?.type in classNameToEditorMapping) {
      const Editor = classNameToEditorMapping[props.data?.type];
      return <Editor {...props} onValueChange={props.onValueChange} ref={ref} />;
    }
  }
);
