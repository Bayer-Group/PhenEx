import React from 'react';
import { ICellRendererParams } from 'ag-grid-community';
import styles from './RowDragCellRenderer.module.css';
import { getHierarchicalBackgroundColor } from './PhenexCellRenderer';

interface SelectionCellRendererProps extends ICellRendererParams {
  colorBackground?: boolean;
  colorBorder?: boolean;
}

export const SelectionCellRenderer: React.FC<SelectionCellRendererProps> = (props) => {
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
    ? `var(--color_${props.data.effective_type}_dim)` 
    : 'transparent';

  const containerStyle: React.CSSProperties = {
    borderTopColor: borderColorVar,
    ...(backgroundColor ? { backgroundColor } : {}),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  };

  // Check if the row is selected
  const isSelected = props.node?.isSelected();

  return (
    <div 
      className={styles.container}
      style={containerStyle}
    >
      {isSelected && <span>✓</span>}
    </div>
  );
};

export default SelectionCellRenderer;
