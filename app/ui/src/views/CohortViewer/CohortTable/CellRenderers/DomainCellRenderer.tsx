import React from 'react';
import styles from './DomainCellRenderer.module.css';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';
import typeStyles from '../../../../styles/study_types.module.css';

const DomainCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const formatDomain = (value: string): string => {
    return value.split('_').join(' ');
  };
  const colorClass = typeStyles[`${props.data.effective_type || ''}_list_item_selected`] || ''
  const renderDomain = (value: string): string => {
    return (
      <span
        className={`${styles.domainContainer} ${colorClass}`}
        onClick={() =>
          props.api?.startEditingCell({
            rowIndex: props.node.rowIndex,
            colKey: props.column.getColId(),
          })
        }
      >
        {props.value ? formatDomain(props.value) : null}
      </span>
    );
  };

  const noDomainPhenotypes = ['ScorePhenotype', 'ArithmeticPhenotype', 'LogicPhenotype'];

  if (props.data.class_name === 'LogicPhenotype'){
  console.log('Rendering domain cell with LOGIC PHENOTYPE:', props);

  }
  if (props.value === undefined || props.value === null || props.value === 'missing') {
    return (
      <PhenexCellRenderer {...props}><div></div>
      </PhenexCellRenderer>
    );
  }
  return (
    <PhenexCellRenderer {...props}>
      {renderDomain(props.value)}
    </PhenexCellRenderer>
  );
};

export default DomainCellRenderer;
