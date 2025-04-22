import React from 'react';
import styles from './DomainCellRenderer.module.css';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';

const DomainCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const formatDomain = (value: string): string => {
    return value.split('_').join(' ');
  };

  const renderDomain = (value: string): string => {
    return (
      <span className={styles.domainContainer}>{props.value ? formatDomain(props.value) : null}</span>
    );
  };

  const noDomainPhenotypes = ['ScorePhenotype', 'ArithmeticPhenotype', 'LogicPhenotype'];
  if (noDomainPhenotypes.includes(props.data.class_name)) {
    return <div></div>;
  }
  return (
    <PhenexCellRenderer {...props}>
      {props.value === 'missing' ? '' : renderDomain(props.value)}
    </PhenexCellRenderer>
  );
};

export default DomainCellRenderer;
