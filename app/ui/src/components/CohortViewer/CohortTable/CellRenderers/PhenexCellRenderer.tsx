import React from 'react';
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

  return (
    <div className={`${styles.containerStyle} ${props.value === 'missing' ? styles.missing : ''}`}>
      {props.children}
      {/* <button className={styles.addToChatButton}>+ chat</button> */}
    </div>
  );
};
