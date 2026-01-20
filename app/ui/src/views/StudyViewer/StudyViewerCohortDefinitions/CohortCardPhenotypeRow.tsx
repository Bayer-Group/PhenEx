import React, { useState, useRef, useEffect } from 'react';
import styles from './CohortCardPhenotypeRow.module.css';
import ArrowIcon from '../../../assets/icons/arrow-up-right.svg';
import { getHierarchicalBackgroundColor } from '@/views/CohortViewer/CohortTable/CellRenderers/PhenexCellRenderer';

interface CohortCardPhenotypeRowProps {
  row: any;
  index: number;
  isSelected: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: (e: React.DragEvent, rowIndex: number) => void;
  onDragOver: (e: React.DragEvent, rowIndex: number) => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: (e: React.MouseEvent, row: any, rowIndex: number) => void;
  onExpandClick: (e: React.MouseEvent) => void;
  onCellValueChanged?: (rowIndex: number, field: string, value: any) => Promise<void>;
}


export const CohortCardPhenotypeRow: React.FC<CohortCardPhenotypeRowProps> = React.memo(({
  row,
  index,
  isSelected,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onClick,
  onExpandClick,
  onCellValueChanged,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(row.name || '');
    setIsEditing(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditing(false);
    }
  };

  const saveEdit = async () => {
    if (onCellValueChanged && editValue.trim() !== row.name) {
      await onCellValueChanged(index, 'name', editValue.trim());
    }
    setIsEditing(false);
  };

  const handleBlur = () => {
    saveEdit();
  };

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
    <>
      {/* Drop indicator line */}
      {isDragOver && (
        <div className={styles.dropIndicator} />
      )}
      
      <div
        className={`${styles.phenotypeRow} ${isSelected ? styles.selected : ''} ${isDragging ? styles.dragging : ''}`}
        style={rowStyle}
        onClick={(e) => onClick(e, row, index)}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDragOver(e, index);
        }}
        onDrop={(e) => {
          e.stopPropagation();
          onDrop(e);
        }}
      >
        {/* Selection indicator */}
        <div className={styles.selectionIndicator}>
          {isSelected && <div className={styles.selectionMark} />}
        </div>
        
        {/* Drag handle */}
        <div 
          ref={dragHandleRef}
          className={styles.dragHandle}
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            onDragStart(e, index);
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
        >
          ⋮⋮
        </div>
      
      {/* Row number */}
      <div className={`${styles.rowNumber} ${styles[`level_${row.level || 0}`]}`}>
        {row.hierarchical_index || index + 1}
      </div>
      
      {/* Phenotype content */}
      <div className={styles.phenotypeContent} onDoubleClick={handleDoubleClick}>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className={styles.phenotypeNameInput}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className={styles.phenotypeName}>
            {row.name || 'Unnamed Phenotype'}
          </div>
        )}
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
    </>
  );
});

CohortCardPhenotypeRow.displayName = 'CohortCardPhenotypeRow';
