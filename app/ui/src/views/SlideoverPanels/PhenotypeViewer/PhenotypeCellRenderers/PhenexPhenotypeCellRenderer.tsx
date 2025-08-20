import React from 'react';
import {
  PhenexCellRenderer,
  PhenexCellRendererProps,
} from '../../../CohortViewer/CohortTable/CellRenderers/PhenexCellRenderer';

export interface PhenexPhenotypeCellRendererProps extends PhenexCellRendererProps {}

import RelativeTimeRangeCellRenderer from '../../../CohortViewer/CohortTable/CellRenderers/RelativeTimeRangeCellRenderer';
import CategoricalFilterCellRenderer from '../../../CohortViewer/CohortTable/CellRenderers/CategoricalFilterCellRenderer';
import CodelistCellRenderer from '../../../CohortViewer/CohortTable/CellRenderers/CodelistCellRenderer';
import PhenotypeCellRenderer from '../../../CohortViewer/CohortTable/CellRenderers/PhenotypeCellRenderer';
import DomainCellRenderer from '../../../CohortViewer/CohortTable/CellRenderers/DomainCellRenderer';
import ValueFilterCellRenderer from '../../../CohortViewer/CohortTable/CellRenderers/ValueFilterCellRenderer';
import LogicalExpressionCellRenderer from '../../../CohortViewer/CohortTable/CellRenderers/LogicalExpressionCellRenderer';
import TypeCellRenderer from '../../../CohortViewer/CohortTable/CellRenderers/TypeCellRenderer';
import DescriptionCellRenderer from '../../../CohortViewer/CohortTable/CellRenderers/DescriptionCellRenderer';

const classNameToRendererMapping = {
  relative_time_range: RelativeTimeRangeCellRenderer,
  categorical_filter: CategoricalFilterCellRenderer,
  codelist: CodelistCellRenderer,
  class_name: PhenotypeCellRenderer,
  domain: DomainCellRenderer,
  value_filter: ValueFilterCellRenderer,
  expression: LogicalExpressionCellRenderer,
  type: TypeCellRenderer,
  description: DescriptionCellRenderer,
};

export const PhenexPhenotypeCellRenderer: React.FC<PhenexPhenotypeCellRendererProps> = props => {
  console.log(props.data);
  if (props.data?.parameter in classNameToRendererMapping) {
    const Renderer = classNameToRendererMapping[props.data?.parameter];
    return <Renderer {...props} fontSize={'12px'} />;
  }
  return <div>{props.data.value}</div>;
};

export default PhenexPhenotypeCellRenderer;
