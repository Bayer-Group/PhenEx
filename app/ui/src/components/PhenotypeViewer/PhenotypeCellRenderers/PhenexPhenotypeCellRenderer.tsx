import React from 'react';
import { PhenexCellRenderer, PhenexCellRendererProps } from '../../CohortViewer/CohortTable/CellRenderers/PhenexCellRenderer';

export interface PhenexPhenotypeCellRendererProps extends PhenexCellRendererProps {}

import RelativeTimeRangeCellRenderer from '../../CohortViewer/CohortTable/CellRenderers/RelativeTimeRangeCellRenderer';
import CategoricalFilterCellRenderer from '../../CohortViewer/CohortTable/CellRenderers/CategoricalFilterCellRenderer';
import CodelistCellRenderer from '../../CohortViewer/CohortTable/CellRenderers/CodelistCellRenderer';
import PhenotypeCellRenderer from '../../CohortViewer/CohortTable/CellRenderers/PhenotypeCellRenderer';
import DomainCellRenderer from '../../CohortViewer/CohortTable/CellRenderers/DomainCellRenderer';
import ValueFilterCellRenderer from '../../CohortViewer/CohortTable/CellRenderers/ValueFilterCellRenderer';

const classNameToRendererMapping = {
  relative_time_range: RelativeTimeRangeCellRenderer,
  categorical_filter: CategoricalFilterCellRenderer,
  codelist: CodelistCellRenderer,
  class_name: PhenotypeCellRenderer, 
  domain: DomainCellRenderer,
  value_filter: ValueFilterCellRenderer
}

export const PhenexPhenotypeCellRenderer: React.FC<PhenexPhenotypeCellRendererProps> = props => {
  if (props.data?.parameter in classNameToRendererMapping) {
    console.log("RENDERING THISKIND OF CELL", props.data?.parameter, props.data)
    const Renderer = classNameToRendererMapping[props.data?.parameter];
    return <Renderer {...props} />;
  }
  return <div>{props.data.value}</div>;
};

export default PhenexPhenotypeCellRenderer;