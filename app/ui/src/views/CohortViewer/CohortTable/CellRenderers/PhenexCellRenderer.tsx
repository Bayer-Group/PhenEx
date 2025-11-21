import React from 'react';
import { ICellRendererParams } from 'ag-grid-community';
import styles from './PhenexCellRenderer.module.css';
import { NARenderer } from './NARenderer';
import { columnNameToApplicablePhenotypeMapping } from '../../../../assets/phenotype_applicable_parameters';
import typeStyles from '../../../../styles/study_types.module.css';

/**
 * Utility function to calculate alpha value based on hierarchical_index depth
 * Used across all cell renderers for consistent hierarchical styling
 */
export const getAlphaForLevel = (hierarchicalIndex: string | undefined): string => {
  if (!hierarchicalIndex) return '33'; // Default dim alpha (hex: 33 ≈ 0.2)
  const depth = hierarchicalIndex.split('.').length;
  // Level 1: 33 (0.2), Level 1.1: 20 (0.125), Level 1.1.1: 10 (0.06)
  if (depth === 1) return '33';
  if (depth === 2) return '20';
  if (depth === 3) return '10';
  return '08'; // For deeper levels
};

/**
 * Utility function to generate background color with hierarchical alpha
 * Uses CSS color-mix to blend type color with transparent based on depth
 */
export const getHierarchicalBackgroundColor = (
  effectiveType: string | undefined,
  hierarchicalIndex: string | undefined
): string | undefined => {
  if (!effectiveType) return undefined;
  
  const alpha = getAlphaForLevel(hierarchicalIndex);
  const colorVar = `--color_${effectiveType}`;
  
  // Use CSS custom property with hierarchical alpha
  return `color-mix(in srgb, var(${colorVar}) ${parseInt(alpha, 16) / 255 * 100}%, transparent)`;
};

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
}

export const PhenexCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const {
    showTopBorder = true,
    showRightBorder = false,
    showBottomBorder = false,
    showLeftBorder = false,
    colorBackground = true,
    colorBorder = true,
  } = props;

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
  const shouldColorBackground = props.data?.colorCellBackground !== undefined 
    ? props.data.colorCellBackground 
    : colorBackground;
  
  const shouldColorBorder = props.data?.colorCellBorder !== undefined 
    ? props.data.colorCellBorder 
    : colorBorder;

  // Get dynamic background color with hierarchical alpha
  const backgroundColor = shouldColorBackground
    ? (isMissing && props.data?.effective_type
      ? `var(--color_${props.data.effective_type})`
      : getHierarchicalBackgroundColor(props.data?.effective_type, props.data?.hierarchical_index))
    : 'transparent';
  const backgroundColorClass = isMissing ? (typeStyles[`${props.data.effective_type}_color_block`] || '') : '';

  // Get the border color CSS variable
  const borderColorVar = shouldColorBorder && props.data?.effective_type 
    ? `var(--color_${props.data.effective_type})` 
    : 'transparent';

  // Build border color object based on which borders are shown
  const borderColors: React.CSSProperties = {};
  if (borderColorVar) {
    if (showTopBorder) borderColors.borderTopColor = borderColorVar;
    if (showRightBorder) borderColors.borderRightColor = borderColorVar;
    if (showBottomBorder) borderColors.borderBottomColor = borderColorVar;
    if (showLeftBorder) borderColors.borderLeftColor = borderColorVar;
  }

  const combinedStyle: React.CSSProperties = {
    ...containerStyle,
    ...borderColors,
    ...(backgroundColor && !isMissing ? { backgroundColor } : {}),
  };

  return (
    <div
      className={`${styles.containerStyle} ${backgroundColorClass}  ${props.node.isSelected() ? styles.selected : ''}`}
      onClick={() => {
        if (props.value === 'missing') {
          props.api?.startEditingCell({
            rowIndex: props.node?.rowIndex ?? 0,
            colKey: props.column?.getColId() ?? '',
          });
        }
      }}
      style={combinedStyle}
    >
      {isMissing ? (
        <span className={styles.missingLabel}>missing</span>
      ) : (
        props.children ? props.children : props.value
      )}
    </div>
  );
};
