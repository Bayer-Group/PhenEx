import React from 'react';
import styles from './DomainCellRenderer.module.css';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';

const DomainCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const formatDomain = (value: string): string => {
    return value.split('_').join(' ');
  };

  const noDomainPhenotypes = ['ScorePhenotype', 'ArithmeticPhenotype', 'LogicPhenotype']
  if (noDomainPhenotypes.includes(props.data.class_name)) {
    return (<div></div>)
  }
  return (
    <PhenexCellRenderer {...props}>
      <div className={styles.domainContainer}>
        {props.value ? formatDomain(props.value) : null}
      </div>
    </PhenexCellRenderer>
  );
};

export default DomainCellRenderer;