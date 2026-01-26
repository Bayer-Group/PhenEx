import React from 'react';
import { PhenexCellRendererProps } from '../../CohortViewer/CohortTable/CellRenderers/PhenexCellRenderer';

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
  console.log('ConstantsCellRenderer received:', {
    type: props.data?.type,
    value: props.value,
    valueType: typeof props.value,
    dataValue: props.data?.value,
    fullData: props.data
  });
  
  if (props.data?.type in classNameToRendererMapping) {
    const Renderer = classNameToRendererMapping[props.data?.type];
    
    // Parse the value if it's a JSON string
    let parsedValue = props.value;
    if (typeof props.value === 'string') {
      try {
        parsedValue = JSON.parse(props.value);
        console.log('Parsed value from string:', parsedValue);
      } catch (e) {
        console.error('Failed to parse value:', props.value, e);
      }
    }
    
    console.log('Using renderer for type:', props.data?.type, 'with parsed value:', parsedValue);
    // Pass all props through (including node, api, column) so child renderer can handle clicks properly
    return <Renderer {...props} value={parsedValue} fontSize={'12px'} />;
  }
  console.log('No renderer found, displaying raw value:', props.data?.value);
  return <div>{props.data.value}</div>;
};

export default ConstantsCellRenderer;
