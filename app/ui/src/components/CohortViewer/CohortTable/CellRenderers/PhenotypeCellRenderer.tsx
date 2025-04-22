import React from 'react';
import styles from './PhenotypeCellRenderer.module.css';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';

const PhenotypeCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const formatPhenotype = (value: string): string => {
    console.log("VALUE IS: ", value, props);
    return value.replace('Phenotype', '');
  };

  return (
    <PhenexCellRenderer {...props}>
      <span className={styles.container}>{props.value ? formatPhenotype(props.value) : null}</span>
    </PhenexCellRenderer>
  );
};

export default PhenotypeCellRenderer;
