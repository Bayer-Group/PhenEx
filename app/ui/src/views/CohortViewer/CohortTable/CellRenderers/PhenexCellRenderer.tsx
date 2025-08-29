import React from 'react';
import { ICellRendererParams } from 'ag-grid-community';
import styles from './PhenexCellRenderer.module.css';
import { NARenderer } from './NARenderer';
import { columnNameToApplicablePhenotypeMapping } from '../../CohortDataService/CohortColumnDefinitions';
import typeStyles from '../../../../styles/study_types.module.css';

export interface PhenexCellRendererProps extends ICellRendererParams {
  children?: React.ReactNode;
  value: string;
  fontSize?: string;
}

export const PhenexCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const containerStyle: React.CSSProperties = {
    fontSize: props.fontSize || '12px',
  };

  const field = props.colDef?.field;
  const isFieldInMapping = field
    ? Object.keys(columnNameToApplicablePhenotypeMapping).includes(field)
    : false;
  if (
    isFieldInMapping &&
    field &&
    !(columnNameToApplicablePhenotypeMapping as any)[field]?.includes(props.data.class_name)
  ) {
    return <NARenderer value={props.value} />;
  }

  // Get dynamic border color class for missing values
  const isMissing = props.value === 'missing';
  const dynamicBorderClass = isMissing && props.data?.type 
    ? typeStyles[`${props.data.type}_border_color`] || ''
    : '';

  return (
    <div
      className={`${styles.containerStyle} ${isMissing ? styles.missing : ''} ${dynamicBorderClass} ${props.node.isSelected() ? styles.selected : ''}`}
      onClick={() => {
        if (props.value === 'missing') {
          props.api?.startEditingCell({
            rowIndex: props.node?.rowIndex ?? 0,
            colKey: props.column?.getColId() ?? '',
          });
        }
      }}
      style={containerStyle}
    >
      {props.children}
    </div>
  );
};
