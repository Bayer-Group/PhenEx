import React from 'react';
import {
  PhenexCellRendererProps,
} from '../../CohortViewer/CohortTable/CellRenderers/PhenexCellRenderer';

export interface ConstantsCellRendererProps extends PhenexCellRendererProps {}

import RelativeTimeRangeCellRenderer from '../../CohortViewer/CohortTable/CellRenderers/RelativeTimeRangeCellRenderer';
import CategoricalFilterCellRenderer from '../../CohortViewer/CohortTable/CellRenderers/CategoricalFilterCellRenderer';
import DomainCellRenderer from '../../CohortViewer/CohortTable/CellRenderers/DomainCellRenderer';
import ValueFilterCellRenderer from '../../CohortViewer/CohortTable/CellRenderers/ValueFilterCellRenderer';


const classNameToRendererMapping = {
  RelativeTimeRangeFilter: RelativeTimeRangeCellRenderer,
  CategoricalFilter: CategoricalFilterCellRenderer,
  Domain: DomainCellRenderer,
  ValueFilter: ValueFilterCellRenderer,
};

export const ConstantsCellRenderer: React.FC<ConstantsCellRendererProps> = props => {
  console.log(props.data)
  if (props.data?.type in classNameToRendererMapping) {
    const Renderer = classNameToRendererMapping[props.data?.type];
    return <Renderer {...props} fontSize={'12px'} />;
  }
  return <div>{props.data.value}</div>;
};

export default ConstantsCellRenderer;
