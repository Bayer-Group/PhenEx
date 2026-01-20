import React, { useState, useRef } from 'react';
import styles from './CohortCardLightWeight.module.css';
import { CohortWithTableData } from './StudyViewerCohortDefinitionsTypes';
import { CohortCardActions } from './CohortCardActions';
import ArrowIcon from '../../../assets/icons/arrow-up-right.svg';
import typeStyles from '../../../styles/study_types.module.css';

interface CohortCardLightWeightProps {
  cohortDef: CohortWithTableData;
  cohortId: string;
  studyDataService: any;
  onCardClick: (cohortDef: CohortWithTableData) => void;
  onCellValueChanged: (cohortId: string, rowIndex: number, field: string, value: any) => Promise<void>;
  onRowDragStart: (rowIndex: number) => void;
  onRowDragOver: (rowIndex: number) => void;
  onRowDrop: (cohortId: string) => Promise<void>;
  isDragging: boolean;
  isScrolling: boolean;
  isShiftPressed: boolean;
  isCommandPressed: boolean;
}

export const CohortCardLightWeight: React.FC<CohortCardLightWeightProps> = React.memo(({
  cohortDef,
  cohortId,
  studyDataService,
  onCardClick,
  onCellValueChanged,
  onRowDragStart,
  onRowDragOver,
  onRowDrop,
  isDragging,
  isScrolling,
  isShiftPressed,
  isCommandPressed,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isHoveringActions, setIsHoveringActions] = useState(false);
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const cardRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const initialPositionSetRef = useRef(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging || isScrolling || isShiftPressed || isCommandPressed || isHoveringActions) return;
    
    if (cardRef.current && actionsRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      
      const computedStyle = getComputedStyle(cardRef.current);
      const zoomScale = parseFloat(computedStyle.getPropertyValue('--zoom-scale')) || 1;
      const adjustedY = relativeY / zoomScale;
      
      if (!initialPositionSetRef.current) {
        actionsRef.current.style.transition = 'none';
        actionsRef.current.style.top = `${adjustedY}px`;
        actionsRef.current.style.opacity = '0';
        requestAnimationFrame(() => {
          if (actionsRef.current) {
            actionsRef.current.style.transition = 'opacity 0.2s ease-out';
            actionsRef.current.style.opacity = '1';
          }
        });
        initialPositionSetRef.current = true;
        return;
      }
      
      actionsRef.current.style.top = `${adjustedY}px`;
    }
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging || isScrolling || isShiftPressed || isCommandPressed) return;
    setIsHovered(true);
    initialPositionSetRef.current = false;
    handleMouseMove(e);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsHoveringActions(false);
    initialPositionSetRef.current = false;
  };

  const handleActionsMouseEnter = () => {
    setIsHoveringActions(true);
    setIsHovered(true);
  };

  const handleActionsMouseLeave = () => {
    setIsHoveringActions(false);
  };

  const handleRowDragStart = (e: React.DragEvent, rowIndex: number) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedRowIndex(rowIndex);
    onRowDragStart(rowIndex);
  };

  const handleRowDragOver = (e: React.DragEvent, rowIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onRowDragOver(rowIndex);
  };

  const handleRowDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedRowIndex(null);
    await onRowDrop(cohortId);
  };

  const toggleRowSelection = (rowIndex: number) => {
    const newSelection = new Set(selectedRows);
    if (newSelection.has(rowIndex)) {
      newSelection.delete(rowIndex);
    } else {
      newSelection.add(rowIndex);
    }
    setSelectedRows(newSelection);
  };

  const handleRowClick = (e: React.MouseEvent, row: any, rowIndex: number) => {
    // If clicking on expand button area, navigate
    if ((e.target as HTMLElement).closest(`.${styles.expandButton}`)) {
      onCardClick(cohortDef);
      return;
    }
    
    // Otherwise toggle selection
    toggleRowSelection(rowIndex);
  };

  const rows = cohortDef.table_data.rows;

  return (
    <div className={styles.verticalCardContainer}>
      <div>
        <div 
          ref={cardRef}
          className={`${styles.cohortCard} ${isHoveringActions ? styles.forceHover : ''} ${(isShiftPressed || isCommandPressed) ? styles.noHover : ''}`}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{ 
            cursor: 'pointer', 
            pointerEvents: 'auto',
            '--dynamic-outline-width': 'calc(3px / var(--zoom-scale))',
            '--dynamic-font-size': 'calc(16px / var(--zoom-scale))',
            '--dynamic-arrow-size': 'min(75px, calc(30px / var(--zoom-scale)))',
            '--dynamic-button-size': 'min(75px, calc(30px / var(--zoom-scale)))'
          } as React.CSSProperties}
        >
          <div className={styles.cohortHeader} style={{ 
            position: 'absolute', 
            bottom: '100%', 
            left: '0', 
            right: '0',
            fontSize: 'var(--dynamic-font-size)'
          }}>
            <div className={styles.cohortHeaderContent}>
              <div className={styles.cohortHeaderTitle}>
                {cohortDef.cohort.name || 'Unnamed Cohort'}
              </div>
              <button
                className={styles.expandButton}
                onClick={(e) => {
                  e.stopPropagation();
                  onCardClick(cohortDef);
                }}
                aria-label="Open cohort"
                style={{ fontSize: 'var(--dynamic-font-size)' }}
              >
                <img
                  src={ArrowIcon}
                  alt="Expand"
                  className={styles.expandArrow}
                />
              </button>
            </div>
          </div>
          
          <div className={styles.topFiller} />
          
          <div className={styles.tableContainer}>
            {rows.length > 0 ? (
              <div className={styles.phenotypeList}>
                {rows.map((row, index) => {
                  // Get background color class based on effective_type
                  const backgroundColorClass = row.effective_type
                    ? typeStyles[`${row.effective_type}_color_block_dim`]
                    : '';
                console.log('Rendering row:', row, 'with background class:', backgroundColorClass);
                  
                  return (
                  <div
                    key={row.id || index}
                    className={`${styles.phenotypeRow} ${backgroundColorClass} ${selectedRows.has(index) ? styles.selected : ''} ${draggedRowIndex === index ? styles.dragging : ''}`}
                    draggable
                    onDragStart={(e) => handleRowDragStart(e, index)}
                    onDragOver={(e) => handleRowDragOver(e, index)}
                    onDrop={handleRowDrop}
                    onClick={(e) => handleRowClick(e, row, index)}
                  >
                    {/* Selection indicator */}
                    <div className={styles.selectionIndicator}>
                      {selectedRows.has(index) && <div className={styles.selectionMark} />}
                    </div>
                    
                    {/* Drag handle */}
                    <div className={styles.dragHandle}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <circle cx="4" cy="3" r="1.5" />
                        <circle cx="4" cy="8" r="1.5" />
                        <circle cx="4" cy="13" r="1.5" />
                        <circle cx="8" cy="3" r="1.5" />
                        <circle cx="8" cy="8" r="1.5" />
                        <circle cx="8" cy="13" r="1.5" />
                        <circle cx="12" cy="3" r="1.5" />
                        <circle cx="12" cy="8" r="1.5" />
                        <circle cx="12" cy="13" r="1.5" />
                      </svg>
                    </div>
                    
                    {/* Row number */}
                    <div className={styles.rowNumber}>
                      {row.sequence_number || index + 1}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        onCardClick(cohortDef);
                      }}
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
                })}
              </div>
            ) : (
              <div className={styles.emptyState}>
                No phenotypes found for this cohort
              </div>
            )}
          </div>
          
          {/* Actions Container */}
          {isHovered && (
            <CohortCardActions
              ref={actionsRef}
              cohortId={cohortId}
              studyDataService={studyDataService}
              onMouseEnter={handleActionsMouseEnter}
              onMouseLeave={handleActionsMouseLeave}
            />
          )}
        </div>
      </div>
    </div>
  );
});

CohortCardLightWeight.displayName = 'CohortCardLightWeight';
