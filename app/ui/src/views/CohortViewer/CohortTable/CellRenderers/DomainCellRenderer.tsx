import React from 'react';
import styles from './DomainCellRenderer.module.css';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';

const DomainCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const formatDomain = (value: string): string => {
    return value.split('_').join(' ');
  };

  const renderDomain = (value: string): string => {
    return (
      <span
        className={styles.domainContainer}
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
  if (noDomainPhenotypes.includes(props.data.class_name)) {
    return <div></div>;
  }
  console.log('Rendering domain cell with value:', props.value);
  if (props.value === undefined || props.value === null || props.value === 'missing') {
    return (
      <PhenexCellRenderer {...props}><></>
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
