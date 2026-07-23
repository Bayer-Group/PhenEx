import React from 'react';
import styles from './NARenderer.module.css';
import { getHierarchicalBackgroundColor } from './hierarchicalCellColors';

interface NARendererProps {
  value: any;
  data?: any;
}

export const NARenderer: React.FC<NARendererProps> = ({ data }) => {
  // Get the border color CSS variable for top border
  const borderColorVar = data?.effective_type 
    ? `var(--color_${data.effective_type}_dim)` 
    : undefined;

  const backgroundColor = getHierarchicalBackgroundColor(
    data?.effective_type,
    data?.hierarchical_index
  );

  const containerStyle: React.CSSProperties = {
    ...(borderColorVar
      ? { borderTopColor: borderColorVar, borderRightColor: borderColorVar }
      : {}),
    ...(backgroundColor ? { backgroundColor } : {}),
  };

  return (
    <div 
      className={styles.naContainer} 
      style={containerStyle}
    >
    </div>
  );
};
