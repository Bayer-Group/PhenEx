import React from 'react';
import { ICellRendererParams } from 'ag-grid-community';
import styles from './PhenexCellRenderer.module.css';
import { NARenderer } from './NARenderer';
import { columnNameToApplicablePhenotypeMapping } from '../../../../assets/phenotype_applicable_parameters';
import typeStyles from '../../../../styles/study_types.module.css';
import { getHierarchicalBackgroundColor } from './hierarchicalCellColors';

export { getAlphaForLevel, getHierarchicalBackgroundColor } from './hierarchicalCellColors';

export interface PhenexCellRendererProps extends ICellRendererParams {
  children?: React.ReactNode;
  value: string;
  fontSize?: string;
  showTopBorder?: boolean;
  showRightBorder?: boolean;
  showBottomBorder?: boolean;
  showLeftBorder?: boolean;
  colorBackground?: boolean;
  colorBorder?: boolean;
  showButtons?: boolean;
  justify?: 'left' | 'right';
  onEdit?: () => void;
  onDelete?: () => void;
}

export const PhenexCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const {
    showTopBorder = true,
    showRightBorder = true,
    showBottomBorder = false,
    showLeftBorder = false,
    colorBackground = false,
    colorBorder = true,
    showButtons = true,
    justify = 'right',
    onEdit: onEditProp,
    onDelete: onDeleteProp,
  } = props;

  // Default handlers if not provided
  const handleEdit = (() => {
    if (!props.node || !props.column || props.node.rowIndex === null) return;
    
    props.api?.startEditingCell({
      rowIndex: props.node.rowIndex,
      colKey: props.column.getColId(),
    });
  });

  const handleDelete = onDeleteProp || (() => {
    if (!props.node || !props.column || props.node.rowIndex === null) return;
    
    const params = {
      rowIndex: props.node.rowIndex,
      colKey: props.column.getColId(),
      key: 'settings',
    };
    props.api?.startEditingCell(params);
  });

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
    return <NARenderer value={props.value} data={props.data} />;
  }

  // Get dynamic border color class for missing values
  const isMissing = props.value === 'missing';

  // Check if data has explicit color properties (override component props)
  
  const shouldColorBorder = props.data?.colorCellBorder !== undefined 
    ? props.data.colorCellBorder 
    : colorBorder;

  // Get dynamic background color with hierarchical alpha
  const backgroundColor ='transparent';
  const textColorClass = isMissing ? (typeStyles[`${props.data.effective_type}_text_color`] || '') : '';

  // Get the border color CSS variable
  const borderColorVar = shouldColorBorder && props.data?.effective_type 
    ? `var(--color_${props.data.effective_type}_dim)` 
    : 'transparent';

  // Build border color object based on which borders are shown
  const borderColors: React.CSSProperties = {};
  if (borderColorVar) {
    if (showTopBorder) borderColors.borderTopColor = borderColorVar;
    if (showRightBorder) borderColors.borderRightColor = borderColorVar;
    if (showBottomBorder) borderColors.borderBottomColor = borderColorVar;
    if (showLeftBorder) borderColors.borderLeftColor = borderColorVar;
  }

  const justifyStyle: React.CSSProperties = justify === 'left'
    ? { justifyContent: 'flex-start', textAlign: 'left' }
    : {};

  const combinedStyle: React.CSSProperties = {
    ...containerStyle,
    ...borderColors,
    // ...(backgroundColor ? { backgroundColor } : {}),
    ...justifyStyle,
  };

  const renderButtons = () =>{
    return (
        <div className={styles.buttonContainer}>
          {/* <button className={styles.deleteButton} onClick={(e) => { e.stopPropagation(); handleDelete(); }}>
            <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
          </button> */}
          <button className={`${styles.editButton} ${typeStyles[`${props.data.effective_type}_text_color`]}`} onClick={(e) => { e.stopPropagation(); handleEdit(); }}>
            Edit
          </button>

        </div>
      );
  }

  return (
    <div
      className={`${styles.containerStyle} ${props.node.isSelected() ? styles.selected : ''} ${showRightBorder ? styles.rightBorder :''}`}

      style={combinedStyle}
    >
      {isMissing ? (
        <span className={`${styles.missingLabel} ${textColorClass}`}       
        onClick={() => {
          props.api?.startEditingCell({
            rowIndex: props.node?.rowIndex ?? 0,
            colKey: props.column?.getColId() ?? '',
          });
      }}>required</span>
      ) : (
        props.children ? props.children : (
          props.value && typeof props.value !== 'object' ? <span className={styles.itemChip} onClick={() => {
            props.api?.startEditingCell({
              rowIndex: props.node?.rowIndex ?? 0,
              colKey: props.column?.getColId() ?? '',
            });
          }}>{props.value}</span> : null
        )
      )}
      
      {/* {showButtons && renderButtons()} */}
    </div>
  );
};
