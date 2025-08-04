import React from 'react';
import styles from './PhenotypeCellRenderer.module.css';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';

const PhenotypeCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const formatPhenotype = (value: string): string => {
    return value.replace('Phenotype', '');
  };

  return (
    <PhenexCellRenderer {...props}>
      <span
        className={styles.container}
        onClick={() =>
          props.api?.startEditingCell({
            rowIndex: props.node.rowIndex,
            colKey: props.column.getColId(),
          })
        }
      >
        {props.value ? formatPhenotype(props.value) : null}
      </span>
    </PhenexCellRenderer>
  );
};

export default PhenotypeCellRenderer;
