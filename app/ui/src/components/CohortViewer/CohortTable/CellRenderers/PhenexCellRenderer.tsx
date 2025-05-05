import React, { useEffect, useState } from 'react';
import { ICellRendererParams } from 'ag-grid-community';
import styles from './PhenexCellRenderer.module.css';

export interface PhenexCellRendererProps extends ICellRendererParams {
  value: string;
  fontSize?: string;
}

export const PhenexCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const containerStyle: React.CSSProperties = {
    fontSize: props.fontSize || '12px',
  };
  return (
    <div
      className={`${styles.containerStyle} ${props.value === 'missing' ? styles.missing : ''} ${props.node.isSelected() ? styles.selected : ''}`}
      onClick={() => {
        if (props.value === 'missing') {
          props.api?.startEditingCell({
            rowIndex: props.node.rowIndex,
            colKey: props.column.getColId(),
          });
        }
      }}
      style={containerStyle}
    >
      {props.children}
    </div>
  );
};
