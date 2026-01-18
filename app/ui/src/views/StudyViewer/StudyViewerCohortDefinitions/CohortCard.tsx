import React, { useState, useRef, useEffect } from 'react';
import styles from './CohortCard.module.css';
import { CohortTable } from '../../CohortViewer/CohortTable/CohortTable';
import { CohortWithTableData } from './StudyViewerCohortDefinitionsTypes';
import { CohortCardActions } from './CohortCardActions';
import ArrowIcon from '../../../assets/icons/arrow-up-right.svg';

interface CohortCardProps {
  cohortDef: CohortWithTableData;
  cohortId: string;
  studyDataService: any;
  onCardClick: (cohortDef: CohortWithTableData) => void;
  onCellValueChanged: (cohortId: string, event: any, selectedRows?: any[]) => Promise<void>;
  onRowDragEnd: (cohortId: string, newRowData: any[]) => Promise<void>;
  calculateRowHeight: (params: any) => number;
  cellRenderers: any;
  tableTheme: any;
  tableGridOptions: any;
  isDragging: boolean;
  isScrolling: boolean;
  isShiftPressed: boolean;
  isCommandPressed: boolean;
}

export const CohortCard: React.FC<CohortCardProps> = React.memo(({
  cohortDef,
  cohortId,
  studyDataService,
  onCardClick,
  onCellValueChanged,
  onRowDragEnd,
  calculateRowHeight,
  cellRenderers,
  tableTheme,
  tableGridOptions,
  isDragging,
  isScrolling,
  isShiftPressed,
  isCommandPressed,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isHoveringActions, setIsHoveringActions] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const initialPositionSetRef = useRef(false);
  const rowCountRef = useRef(cohortDef.table_data.rows.length);

  // Preserve hover state when data changes (phenotype added)
  useEffect(() => {
    const newRowCount = cohortDef.table_data.rows.length;
    if (newRowCount !== rowCountRef.current) {
      rowCountRef.current = newRowCount;
      // Don't reset initialPositionSetRef if we're still hovering
      // This preserves the actions position during data updates
    }
  }, [cohortDef.table_data.rows.length]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't update position when dragging, scrolling, shift/command pressed, or hovering over actions
    if (isDragging || isScrolling || isShiftPressed || isCommandPressed || isHoveringActions) return;
    
    if (cardRef.current && actionsRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      
      // Get the current zoom scale from CSS variable
      const computedStyle = getComputedStyle(cardRef.current);
      const zoomScale = parseFloat(computedStyle.getPropertyValue('--zoom-scale')) || 1;
      
      // Adjust for zoom scale - divide by scale to compensate for transform
      const adjustedY = relativeY / zoomScale;
      
      // Set initial position immediately without transition on first hover
      if (!initialPositionSetRef.current) {
        actionsRef.current.style.transition = 'none';
        actionsRef.current.style.top = `${adjustedY}px`;
        actionsRef.current.style.opacity = '0';
        // Fade in after position is set
        requestAnimationFrame(() => {
          if (actionsRef.current) {
            actionsRef.current.style.transition = 'opacity 0.2s ease-out';
            actionsRef.current.style.opacity = '1';
          }
        });
        initialPositionSetRef.current = true;
        return;
      }
      
      // Direct DOM manipulation - no React re-render
      actionsRef.current.style.top = `${adjustedY}px`;
    }
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging || isScrolling || isShiftPressed || isCommandPressed) return;
    setIsHovered(true);
    initialPositionSetRef.current = false;
    // Trigger initial position set
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
            {cohortDef.table_data.rows.length > 0 ? (
              <CohortTable
                data={cohortDef.table_data}
                onCellValueChanged={(event, selectedRows) => onCellValueChanged(cohortId, event, selectedRows)}
                onRowDragEnd={(newRowData) => onRowDragEnd(cohortId, newRowData)}
                currentlyViewing="cohort-definitions"
                domLayout="autoHeight"
                headerHeight={0}
                customGetRowHeight={calculateRowHeight}
                tableTheme={tableTheme}
                tableGridOptions={tableGridOptions}
                components={cellRenderers}
              />
            ) : (
              <div style={{ padding: '1rem', color: '#666', fontStyle: 'italic' }}>
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

CohortCard.displayName = 'CohortCard';
