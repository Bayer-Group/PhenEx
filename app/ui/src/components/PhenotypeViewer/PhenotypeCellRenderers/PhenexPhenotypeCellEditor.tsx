import React, { forwardRef, useImperativeHandle } from 'react';
import { PhenexCellEditor, PhenexCellEditorProps } from '../../CohortViewer/CohortTable/CellEditors/PhenexCellEditor';
import { RelativeTimeRangeFilterCellEditor }  from '../../CohortViewer/CohortTable/CellEditors/RelativeTimeRangeFilterCellEditor';
import { CategoricalFilterCellEditor } from '../../CohortViewer/CohortTable/CellEditors/CategoricalFilterCellEditor';
import { CodelistCellEditor } from '../../CohortViewer/CohortTable/CellEditors/CodelistCellEditor';
import { ValueFilterCellEditor } from '../../CohortViewer/CohortTable/CellEditors/ValueFilterCellEditor';
import { PhenotypeSelectorCellEditor } from '../../CohortViewer/CohortTable/CellEditors/PhenotypeSelectorCellEditor';

import {DomainSelectorCellEditor} from '../../CohortViewer/CohortTable/CellEditors/DomainSelectorCellEditor';
import {LogicalExpressionCellEditor} from '../../CohortViewer/CohortTable/CellEditors/LogicalExpressionCellEditor';
import {DescriptionCellEditor} from '../../CohortViewer/CohortTable/CellEditors/DescriptionCellEditor';
import { TypeSelectorCellEditor } from '../../CohortViewer/CohortTable/CellEditors/TypeSelectorCellEditor';

export interface PhenexPhenotypeCellEditorProps extends ICellEditorParams {
  value?: any;
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
  type: TypeSelectorCellEditor
}


export const PhenexPhenotypeCellEditor = forwardRef((props: PhenexPhenotypeCellEditorProps, ref) => {
  if (props.data?.parameter in classNameToEditorMapping) {
    const Editor = classNameToEditorMapping[props.data?.parameter];
    return <Editor {...props} onValueChange={props.onValueChange} ref={ref} />;
  }
  return <PhenexCellEditor {...props} onValueChange={props.onValueChange} ref={ref} />;
});

