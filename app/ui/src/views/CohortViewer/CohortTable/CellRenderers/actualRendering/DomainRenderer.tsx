import React from 'react';
import styles from '../DomainCellRenderer.module.css';
import typeStyles from '../../../../../styles/study_types.module.css';

export interface DomainRendererProps {
  value: string | null | undefined;
  data?: any;
  onClick?: () => void;
}

/**
 * DomainRenderer - Reusable component for rendering domain values
 * Can be used in both CellRenderers and CellEditors
 * 
 * @param value - The domain value to render
 * @param effectiveType - The effective type for styling
 * @param onClick - Optional callback when the domain is clicked
 */
export const DomainRenderer: React.FC<DomainRendererProps> = ({
  value,
  data,
  onClick,
}) => {
  const effectiveType = data?.effective_type;
  const formatDomain = (val: string): string => {
    return val.split('_').join(' ');
  };

  const colorClass = typeStyles[`${effectiveType || ''}_list_item_selected`] || '';
  
  if (!value) return null;

  return (
    <span
      className={`${styles.domainContainer} ${colorClass}`}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) {
          onClick();
        }
      }}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {formatDomain(value)}
    </span>
  );
};
