import React, { useEffect, useState } from 'react';
import { ICellRendererParams } from 'ag-grid-community';
import styles from './PhenexCellRenderer.module.css';

export interface PhenexCellRendererProps extends ICellRendererParams {
  value: string;
}

export const PhenexCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    height: '100%',
    padding: '0',
    position: 'relative',
  };

  console.log("IS SELECTED", props.node.isSelected());

  return (
    <div 
      className={`${styles.containerStyle} ${props.value === 'missing' ? styles.missing : ''} ${props.node.isSelected() ? styles.selected : ''}`}
      onClick={() => {
        if (props.value === 'missing') {
          props.api?.startEditingCell({
            rowIndex: props.node.rowIndex,
            colKey: props.column.getColId()
          });
        }
      }}
    >
      {props.children}
    </div>
  );
};
