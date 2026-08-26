import React from 'react';
import { ICellRendererParams } from '@ag-grid-community/core';
import styles from './InfoPanelNameCellRenderer.module.css';

export const InfoPanelNameCellRenderer: React.FC<ICellRendererParams> = (params) => {
  const title = params.value ?? params.data?.name ?? '';

  return (
    <div className={styles.wrapper}>
      <div className={styles.labelBox}><span className={styles.labelText}>{title}</span></div>
    </div>
  );
};

export default InfoPanelNameCellRenderer;
