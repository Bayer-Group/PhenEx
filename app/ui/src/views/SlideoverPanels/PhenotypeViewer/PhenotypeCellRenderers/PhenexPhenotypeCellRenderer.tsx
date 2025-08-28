import React from 'react';
import {
  PhenexCellRendererProps,
} from '../../../CohortViewer/CohortTable/CellRenderers/PhenexCellRenderer';
import parametersInfo from '../../../../assets/parameters_info.json';

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

const classNameToRendererMapping: { [key: string]: React.ComponentType<any> } = {
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

// Helper function to check if value is missing or empty
const isValueMissingOrEmpty = (value: any): boolean => {
  return value === null || 
         value === undefined || 
         value === '' || 
         value === 'missing' ||
         (typeof value === 'string' && value.trim() === '');
};

// Helper function to get parameter description
const getParameterDescription = (parameter: string): string => {
  const paramInfo = (parametersInfo as any)[parameter];
  return paramInfo?.description || 'No description available for this parameter.';
};

export const PhenexPhenotypeCellRenderer: React.FC<PhenexPhenotypeCellRendererProps> = props => {
  // Check if value is missing/empty and we have a parameter to show description for
  if (isValueMissingOrEmpty(props.data?.value) && props.data?.parameter) {
    const description = getParameterDescription(props.data.parameter);
    return (
      <div style={{ 
        fontSize: '18px', 
        fontStyle: 'italic', 
        color: '#666',
        padding: '4px',
        lineHeight: '1.4'
      }}>
        {description}
      </div>
    );
  }

  if (props.data?.parameter in classNameToRendererMapping) {
    const Renderer = classNameToRendererMapping[props.data?.parameter];
    return <Renderer {...props} fontSize={'18px'} />;
  }
  
  return <div>{props.data?.value}</div>;
};

export default PhenexPhenotypeCellRenderer;
