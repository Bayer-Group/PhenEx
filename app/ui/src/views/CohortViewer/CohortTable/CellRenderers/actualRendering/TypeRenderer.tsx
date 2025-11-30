import React from 'react';
import styles from '../TypeCellRenderer.module.css';
import typeStyles from '../../../../../styles/study_types.module.css';

export interface TypeRendererProps {
  value: string | null | undefined;
  data?: any;
  onClick?: () => void;
}

/**
 * TypeRenderer - Reusable component for rendering phenotype type information
 * Can be used in both CellRenderers and CellEditors
 * 
 * @param value - The type value to render
 * @param effectiveType - The effective type for styling
 * @param hierarchicalIndex - The hierarchical index for component phenotypes
 * @param type - The actual type (component, entry, etc.)
 * @param level - The indentation level for component phenotypes
 * @param count - Optional count to display
 * @param onClick - Optional callback when the type is clicked
 */
export const TypeRenderer: React.FC<TypeRendererProps> = ({
  value,
  data,
  onClick,
}) => {
  const effectiveType = data?.effective_type;
  const hierarchicalIndex = data?.hierarchical_index;
  const type = data?.type;
  const level = data?.level || 0;
  const count = data?.count;
  const renderComponentDisplay = () => {
    if (type === 'component') {
      if (hierarchicalIndex) {
        return hierarchicalIndex;
      }
    }
    
    if (hierarchicalIndex) {
      return hierarchicalIndex;
    }
    
    // For non-components: show type + index
    const displayType = type === 'component' && effectiveType ? effectiveType : value;
    return `${displayType || ''}`;
  };

  const renderCount = () => {
    return (
      typeof count !== 'undefined' && (
        <div className={`${styles.countdiv} ${colorClassText}`}>{count}</div>
      )
    );
  };

  // Use effective_type for coloring if available, otherwise fall back to type
  const typeForColor = effectiveType || value;
  const colorClassText = `${styles.ancestorLabel} ${typeStyles[`${typeForColor || ''}_text_color`] || ''}`;

  // Calculate indentation for component phenotypes based on their level
  const getIndentationStyle = () => {
    if (type === 'component' && level > 0) {
      return {
        marginLeft: `calc(var(--type-label-indent) * ${level})`
      };
    }
    return {};
  };

  return (
    <div 
      className={styles.container} 
      style={{
        ...getIndentationStyle(),
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent'
      }}
    >
      <span
        className={`${styles.block} ${colorClassText}`}
        onClick={(e) => {
          e.stopPropagation();
          if (onClick) {
            onClick();
          }
        }}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
      >
        {renderComponentDisplay()}
      </span>
      {renderCount()}
    </div>
  );
};
