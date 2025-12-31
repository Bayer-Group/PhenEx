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
    alignItems: 'flex-start',
    justifyContent: 'center',
    height: '100%',
    paddingTop: '7px',
    paddingLeft: '4px',
    paddingRight: '2px',
  };

  const checkmarkCircleStyle: React.CSSProperties = {
    width: '15px',
    height: '15px',
    borderRadius: '50%',
    backgroundColor: 'var(--color_accent_blue)',
    // border: '1px solid white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '10px',
    fontWeight: 'bold',
  };

  // Check if the row is selected
  const isSelected = props.node?.isSelected();

  return (
    <div 
      className={styles.container}
      style={containerStyle}
    >
      {isSelected && (
        <div style={checkmarkCircleStyle}>
          ✓
        </div>
      )}
    </div>
  );
};

export default SelectionCellRenderer;
