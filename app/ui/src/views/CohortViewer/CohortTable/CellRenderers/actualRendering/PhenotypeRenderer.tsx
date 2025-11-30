import React from 'react';
import styles from '../PhenotypeCellRenderer.module.css';
import typeStyles from '../../../../../styles/study_types.module.css';

export interface PhenotypeRendererProps {
  value: string | null | undefined;
  data?: any;
  onClick?: () => void;
}

/**
 * PhenotypeRenderer - Reusable component for rendering phenotype values
 * Can be used in both CellRenderers and CellEditors
 * 
 * @param value - The phenotype value to render
 * @param effectiveType - The effective type for styling
 * @param onClick - Optional callback when the phenotype is clicked
 */
export const PhenotypeRenderer: React.FC<PhenotypeRendererProps> = ({
  value,
  data,
  onClick,
}) => {
  const effectiveType = data?.effective_type;
  const formatPhenotype = (val: string): string => {
    return val.replace('Phenotype', '');
  };

  const colorClass = typeStyles[`${effectiveType || ''}_list_item_selected`] || '';

  if (!value) return null;

  return (
    <span
      className={`${styles.container} ${colorClass}`}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) {
          onClick();
        }
      }}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {formatPhenotype(value)}
    </span>
  );
};
