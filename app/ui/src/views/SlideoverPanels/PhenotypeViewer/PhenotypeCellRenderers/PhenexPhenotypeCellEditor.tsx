import { forwardRef } from 'react';
import { ICellEditorParams } from '@ag-grid-community/core';
import {
  PhenexCellEditor,
} from '../../../CohortViewer/CohortTable/CellEditors/PhenexCellEditor';
import { RelativeTimeRangeFilterCellEditor } from '../../../CohortViewer/CohortTable/CellEditors/RelativeTimeRangeFilterCellEditor';
import { CategoricalFilterCellEditor } from '../../../CohortViewer/CohortTable/CellEditors/CategoricalFilterCellEditor';
import { CodelistCellEditor } from '../../../CohortViewer/CohortTable/CellEditors/CodelistCellEditor';
import { ValueFilterCellEditor } from '../../../CohortViewer/CohortTable/CellEditors/ValueFilterCellEditor';
import { PhenotypeSelectorCellEditor } from '../../../CohortViewer/CohortTable/CellEditors/PhenotypeSelectorCellEditor';

import { DomainSelectorCellEditor } from '../../../CohortViewer/CohortTable/CellEditors/DomainSelectorCellEditor';
import { LogicalExpressionCellEditor } from '../../../CohortViewer/CohortTable/CellEditors/LogicalExpressionCellEditor';
import { DescriptionCellEditor } from '../../../CohortViewer/CohortTable/CellEditors/DescriptionCellEditor';
import { TypeSelectorCellEditor } from '../../../CohortViewer/CohortTable/CellEditors/TypeSelectorCellEditor';
import { ReturnDateCellEditor } from '@/views/CohortViewer/CohortTable/CellEditors/ReturnDateCellEditor';

export interface PhenexPhenotypeCellEditorProps extends ICellEditorParams {
  onValueChange?: (value: any) => void;
}

const classNameToEditorMapping = {
  relative_time_range: RelativeTimeRangeFilterCellEditor,
  categorical_filter: CategoricalFilterCellEditor,
  codelist: CodelistCellEditor,
  value_filter: ValueFilterCellEditor,
  class_name: PhenotypeSelectorCellEditor,
  domain: DomainSelectorCellEditor,
  expression: LogicalExpressionCellEditor,
  description: DescriptionCellEditor,
  type: TypeSelectorCellEditor,
  return_date: ReturnDateCellEditor,
};

export const PhenexPhenotypeCellEditor = forwardRef(
  (props: PhenexPhenotypeCellEditorProps, ref) => {
    const parameter = props.data?.parameter;
    if (parameter && parameter in classNameToEditorMapping) {
      const Editor = classNameToEditorMapping[parameter as keyof typeof classNameToEditorMapping];
      console.log("SHOWING EDITOR FOR", parameter, props.onValueChange);
      return <Editor {...props} onValueChange={props.onValueChange} fieldName={parameter} ref={ref} />;
    }
    return <PhenexCellEditor {...props} onValueChange={props.onValueChange} fieldName={parameter} ref={ref} />;
  }
);
