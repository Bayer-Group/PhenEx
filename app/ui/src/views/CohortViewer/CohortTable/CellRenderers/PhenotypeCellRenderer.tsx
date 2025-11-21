import React from 'react';
import styles from './PhenotypeCellRenderer.module.css';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';
import typeStyles from '../../../../styles/study_types.module.css';

const PhenotypeCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const formatPhenotype = (value: string): string => {
    return value.replace('Phenotype', '');
  };
  const colorClass = typeStyles[`${props.data.effective_type || ''}_list_item_selected`] || '';

  return (
    <PhenexCellRenderer {...props} showRightBorder={true}>
      <span
        className={`${styles.container} ${colorClass}`}
        onClick={() =>
          props.api?.startEditingCell({
            rowIndex: props.node.rowIndex ?? 0,
            colKey: props.column?.getColId() ?? '',
          })
        }
      >
        {props.value ? formatPhenotype(props.value) : null}
      </span>
    </PhenexCellRenderer>
  );
};

export default PhenotypeCellRenderer;
