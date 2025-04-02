import React from 'react';
import styles from './PhenotypeCellRenderer.module.css';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';

const PhenotypeCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const formatPhenotype = (value: string): string => {
    return value.replace('Phenotype', '');
  };

  return (
    <PhenexCellRenderer {...props}>
      <div className={styles.container}>{props.value ? formatPhenotype(props.value) : null}</div>
    </PhenexCellRenderer>
  );
};

export default PhenotypeCellRenderer;
