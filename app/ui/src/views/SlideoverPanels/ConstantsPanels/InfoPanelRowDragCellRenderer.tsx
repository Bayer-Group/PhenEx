import React from 'react';
import { ICellRendererParams } from 'ag-grid-community';
import styles from './InfoPanelRowDragCellRenderer.module.css';

interface InfoPanelRowDragCellRendererProps extends ICellRendererParams {
  colorBackground?: boolean;
  colorBorder?: boolean;
}

export const InfoPanelRowDragCellRenderer: React.FC<InfoPanelRowDragCellRendererProps> = (props) => {
  const {
  } = props;

  return (
    <div 
      className={styles.container}
    >
      {/* Empty div - AG Grid handles row drag visualization */}
    </div>
  );
};

export default InfoPanelRowDragCellRenderer;
