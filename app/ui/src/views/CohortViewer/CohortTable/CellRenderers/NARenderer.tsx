import React from 'react';
import styles from './NARenderer.module.css';

interface NARendererProps {
  value: any;
  data?: any;
}

export const NARenderer: React.FC<NARendererProps> = ({ data }) => {
  // Get the border color CSS variable for top border
  const borderColorVar = data?.effective_type 
    ? `var(--color_${data.effective_type}_dim)` 
    : undefined;

  const containerStyle: React.CSSProperties = borderColorVar 
    ? { borderTopColor: borderColorVar } 
    : {};

  return (
    <div 
      className={styles.naContainer} 
      style={containerStyle}
    >
    </div>
  );
};
