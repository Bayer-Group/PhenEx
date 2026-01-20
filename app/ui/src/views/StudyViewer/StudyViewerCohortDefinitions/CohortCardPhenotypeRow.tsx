import React from 'react';
import styles from './CohortCardPhenotypeRow.module.css';
import ArrowIcon from '../../../assets/icons/arrow-up-right.svg';
import { getHierarchicalBackgroundColor } from '@/views/CohortViewer/CohortTable/CellRenderers/PhenexCellRenderer';

interface CohortCardPhenotypeRowProps {
  row: any;
  index: number;
  isSelected: boolean;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, rowIndex: number) => void;
  onDragOver: (e: React.DragEvent, rowIndex: number) => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: (e: React.MouseEvent, row: any, rowIndex: number) => void;
  onExpandClick: (e: React.MouseEvent) => void;
}


export const CohortCardPhenotypeRow: React.FC<CohortCardPhenotypeRowProps> = React.memo(({
  row,
  index,
  isSelected,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
  onClick,
  onExpandClick,
}) => {
  // Get background color with hierarchical alpha
  const backgroundColor = getHierarchicalBackgroundColor(
    row.effective_type,
    row.hierarchical_index
  );

  // Get border color CSS variable (using _dim suffix like PhenexCellRenderer)
  const borderColorVar = row.effective_type 
    ? `var(--color_${row.effective_type}_dim)` 
    : 'transparent';

  // Build style object with background and border colors
  const rowStyle: React.CSSProperties = {
    ...(backgroundColor ? { backgroundColor } : {}),
    borderTopColor: borderColorVar,
  };

  return (
    <div
      className={`${styles.phenotypeRow} ${isSelected ? styles.selected : ''} ${isDragging ? styles.dragging : ''}`}
      style={rowStyle}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={onDrop}
      onClick={(e) => onClick(e, row, index)}
    >
      {/* Selection indicator */}
      <div className={styles.selectionIndicator}>
        {isSelected && <div className={styles.selectionMark} />}
      </div>
      
      {/* Drag handle */}
      <div className={styles.dragHandle}>
        ⋮⋮
      </div>
      
      {/* Row number */}
      <div className={`${styles.rowNumber} ${styles[`level_${row.level || 0}`]}`}>
        {row.hierarchical_index || index + 1}
      </div>
      
      {/* Phenotype content */}
      <div className={styles.phenotypeContent}>
        <div className={styles.phenotypeName}>
          {row.name || 'Unnamed Phenotype'}
        </div>
        {row.description && (
          <div className={styles.phenotypeDescription}>
            {row.description}
          </div>
        )}
      </div>
      
      {/* Expand button */}
      <button
        className={styles.expandButton}
        onClick={onExpandClick}
        aria-label="Expand phenotype"
      >
        <img
          src={ArrowIcon}
          alt="Expand"
          className={styles.expandArrow}
        />
      </button>
    </div>
  );
});

CohortCardPhenotypeRow.displayName = 'CohortCardPhenotypeRow';
