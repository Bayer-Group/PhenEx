import React from 'react';
import { ICellRendererParams } from 'ag-grid-community';
import styles from './RowDragCellRenderer.module.css';
import { getHierarchicalBackgroundColor } from './PhenexCellRenderer';

interface RowDragCellRendererProps extends ICellRendererParams {
  colorBackground?: boolean;
  colorBorder?: boolean;
}

export const RowDragCellRenderer: React.FC<RowDragCellRendererProps> = (props) => {
  const {
    colorBackground = true,
    colorBorder = true,
  } = props;

  // Check if data has explicit color properties (override component props)
  const shouldColorBackground = props.data?.colorCellBackground !== undefined 
    ? props.data.colorCellBackground 
    : colorBackground;
  
  const shouldColorBorder = props.data?.colorCellBorder !== undefined 
    ? props.data.colorCellBorder 
    : colorBorder;

  // Get dynamic background color with hierarchical alpha
  const backgroundColor = shouldColorBackground
    ? getHierarchicalBackgroundColor(props.data?.effective_type, props.data?.hierarchical_index)
    : 'transparent';

  // Get the border color CSS variable for top border
  const borderColorVar = shouldColorBorder && props.data?.effective_type 
    ? `var(--color_${props.data.effective_type})` 
    : 'transparent';

  const containerStyle: React.CSSProperties = {
    borderTopColor: borderColorVar,
    ...(backgroundColor ? { backgroundColor } : {}),
  };

  return (
    <div 
      className={styles.container}
      style={containerStyle}
    >
      {/* Empty div - AG Grid handles row drag visualization */}
    </div>
  );
};

export default RowDragCellRenderer;
