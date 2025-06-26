import React, { useEffect, useState } from 'react';
import { ICellRendererParams } from 'ag-grid-community';
import styles from './PhenexCellRenderer.module.css';
import { NARenderer } from './NARenderer';
import { columnNameToApplicablePhenotypeMapping } from '../../CohortDataService/CohortColumnDefinitions';

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
  const isFieldInMapping = field ? Object.keys(columnNameToApplicablePhenotypeMapping).includes(field) : false;
  if (isFieldInMapping && !columnNameToApplicablePhenotypeMapping[field]?.includes(props.data.class_name)) {
    return <NARenderer value={props.value} />
  }

  return (
    <div
      className={`${styles.containerStyle} ${props.value === 'missing' ? styles.missing : ''} ${props.node.isSelected() ? styles.selected : ''}`}
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
