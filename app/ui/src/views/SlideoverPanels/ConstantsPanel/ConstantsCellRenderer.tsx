import React from 'react';
import { PhenexCellRendererProps } from '../../CohortViewer/CohortTable/CellRenderers/PhenexCellRenderer';
import styles from './ConstantsCellRenderer.module.css';

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
  if (props.data?.type in classNameToRendererMapping) {
    const Renderer = classNameToRendererMapping[props.data?.type];
    
    // Parse the value if it's a JSON string
    let parsedValue = props.value;
    if (typeof props.value === 'string') {
      try {
        parsedValue = JSON.parse(props.value);
      } catch (e) {
        console.error('Failed to parse value:', props.value, e);
      }
    }
    
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <Renderer {...props} value={parsedValue} fontSize={'2px'} />
        </div>
      </div>
    );
  }
  return <div>{props.data.value}</div>;
};

export default ConstantsCellRenderer;
