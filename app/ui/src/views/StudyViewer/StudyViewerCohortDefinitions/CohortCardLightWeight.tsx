import React, { useState, useRef } from 'react';
import styles from './CohortCardLightWeight.module.css';
import { CohortWithTableData } from './StudyViewerCohortDefinitionsTypes';
import { CohortCardActions } from './CohortCardActions';
import { CohortCardPhenotypeRow } from './CohortCardPhenotypeRow';
import { TwoPanelCohortViewerService } from '../../CohortViewer/TwoPanelCohortViewer/TwoPanelCohortViewer';
import { CohortViewType } from '../../CohortViewer/CohortViewer';
import ArrowIcon from '../../../assets/icons/arrow-up-right.svg';
import { RightClickMenuItem } from '../../../components/RightClickMenu/RightClickMenu';
import { ScaledRightClickMenu } from '../../../components/RightClickMenu/ScaledRightClickMenu';

interface CohortCardLightWeightProps {
  cohortDef: CohortWithTableData;
  cohortId: string;
  studyDataService: any;
  onCardClick: (cohortDef: CohortWithTableData) => void;
  onCellValueChanged: (cohortId: string, rowIndex: number, field: string, value: any) => Promise<void>;
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
  isDragging,
  isScrolling,
  isShiftPressed,
  isCommandPressed,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isHoveringActions, setIsHoveringActions] = useState(false);
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);
  const [dragOverRowIndex, setDragOverRowIndex] = useState<number | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const cardRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const initialPositionSetRef = useRef(false);
  const [rightClickMenu, setRightClickMenu] = useState<{ position: { x: number; y: number }; rowIndex: number | null } | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const titleInputRef = useRef<HTMLTextAreaElement>(null);

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
  };

  const handleRowDragOver = (e: React.DragEvent, rowIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverRowIndex(rowIndex);
  };

  const handleRowDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    
    if (draggedRowIndex === null || dragOverRowIndex === null || draggedRowIndex === dragOverRowIndex) {
      setDraggedRowIndex(null);
      setDragOverRowIndex(null);
      return;
    }

    // Reorder rows within this cohort
    const newRows = [...cohortDef.table_data.rows];
    const [removed] = newRows.splice(draggedRowIndex, 1);
    newRows.splice(dragOverRowIndex, 0, removed);

    // Persist to backend
    await studyDataService.cohort_definitions_service.onRowDragEnd(cohortId, newRows);

    setDraggedRowIndex(null);
    setDragOverRowIndex(null);
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

  const handleRowEdit = (row: any) => {
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('phenotype' as CohortViewType, row);
  };

  const handleContextMenu = (e: React.MouseEvent, rowIndex: number | null = null) => {
    e.preventDefault();
    setRightClickMenu({
      position: { x: e.clientX, y: e.clientY },
      rowIndex
    });
  };

  const handleCloseRightClickMenu = () => {
    setRightClickMenu(null);
  };

  const handleTitleDoubleClick = () => {
    setIsEditingTitle(true);
    setEditedTitle(cohortDef.cohort.name || '');
    // Focus input after state update
    setTimeout(() => {
      if (titleInputRef.current) {
        titleInputRef.current.focus();
        titleInputRef.current.select();
        // Set initial height
        titleInputRef.current.style.height = 'auto';
        titleInputRef.current.style.height = titleInputRef.current.scrollHeight + 'px';
      }
    }, 0);
  };

  const handleTitleSave = async () => {
    if (editedTitle.trim() && editedTitle !== cohortDef.cohort.name) {
      try {
        // Set this cohort as the active one first
        studyDataService.cohort_definitions_service.setActiveCohort(cohortId);
        console.log("Updating cohort name to:", studyDataService.cohort_definitions_service);
        // Get the CohortModel instance and update the name
        const cohortModel = studyDataService.cohort_definitions_service._cohortModels.get(cohortId);
        if (cohortModel) {
          cohortModel.cohort_name = editedTitle.trim();
          cohortModel.cohort_data.name = editedTitle.trim(); // Also update the cohort_data directly
          // Save changes - this updates backend and notifies all listeners
          await cohortModel.saveChangesToCohort(true, false); // Save without refreshing grid
        }
      } catch (error) {
        console.error('Failed to update cohort name:', error);
      }
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditingTitle(false);
      setEditedTitle(cohortDef.cohort.name || '');
    }
  };

  const handleDeleteCohort = async () => {
    if (!window.confirm(`Are you sure you want to delete "${cohortDef.cohort.name || 'Unnamed Cohort'}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const cohortModel = studyDataService.cohort_definitions_service._cohortModels.get(cohortId);
      if (cohortModel) {
        await cohortModel.deleteCohort();
        // Refresh the study data to update the UI
        await studyDataService.refreshStudyData();
      }
    } catch (error) {
      console.error('Failed to delete cohort:', error);
      alert('Failed to delete cohort. Please try again.');
    }
  };

  const handleAddPhenotype = (type: string) => {
    studyDataService.cohort_definitions_service.addPhenotype(cohortId, type);
  };

  const getRightClickMenuItems = (): RightClickMenuItem[] => {
    if (rightClickMenu?.rowIndex !== null && rightClickMenu?.rowIndex !== undefined) {
      // Row-specific menu items
      const row = rows[rightClickMenu.rowIndex];
      return [
        {
          label: 'Edit Phenotype',
          onClick: () => handleRowEdit(row)
        },
        {
          label: 'Duplicate Row',
          onClick: () => console.log('Duplicate row', rightClickMenu.rowIndex),
          disabled: true
        },
        {
          label: 'Delete Row',
          onClick: () => console.log('Delete row', rightClickMenu.rowIndex),
          disabled: true,
          divider: true
        },
        {
          label: 'Move Up',
          onClick: () => console.log('Move up', rightClickMenu.rowIndex),
          disabled: rightClickMenu.rowIndex === 0
        },
        {
          label: 'Move Down',
          onClick: () => console.log('Move down', rightClickMenu.rowIndex),
          disabled: rightClickMenu.rowIndex === rows.length - 1
        }
      ];
    } else {
      // Card-level menu items
      return [
        {
          label: 'Open Cohort',
          onClick: () => onCardClick(cohortDef),
          icon: (
            <svg width="14" height="14" viewBox="0 0 48 48" fill="none" style={{ flexShrink: 0 }}>
              <path d="M14 34L34 14M34 14H14M34 14V34" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
            </svg>
          )
        },
        {
          label: 'Add Phenotype',
          onClick: () => {}, // No-op, submenu handles clicks
          disabled: false,
          divider: true,
          submenu: [
            {
              label: 'Entry',
              onClick: () => handleAddPhenotype('entry'),
              keepOpenOnClick: true
            },
            {
              label: 'Inclusion',
              onClick: () => handleAddPhenotype('inclusion'),
              keepOpenOnClick: true
            },
            {
              label: 'Exclusion',
              onClick: () => handleAddPhenotype('exclusion'),
              keepOpenOnClick: true
            },
            {
              label: 'Baseline Characteristic',
              onClick: () => handleAddPhenotype('baseline'),
              keepOpenOnClick: true
            },
            {
              label: 'Outcome',
              onClick: () => handleAddPhenotype('outcome'),
              keepOpenOnClick: true
            }
          ]
        },
        {
          label: 'Info',
          onClick: () => {
            const cohortViewer = TwoPanelCohortViewerService.getInstance();
            cohortViewer.displayExtraContent('info', null);
          },
          icon: (
            <svg width="14" height="14" viewBox="0 0 48 48" fill="none" style={{ flexShrink: 0 }}>
              <path d="M14 34L34 14M34 14H14M34 14V34" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
            </svg>
          )
        },
        {
          label: 'Database',
          onClick: () => {
            const cohortViewer = TwoPanelCohortViewerService.getInstance();
            cohortViewer.displayExtraContent('database', null);
          },
          icon: (
            <svg width="14" height="14" viewBox="0 0 48 48" fill="none" style={{ flexShrink: 0 }}>
              <path d="M14 34L34 14M34 14H14M34 14V34" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
            </svg>
          )
        },
        {
          label: 'Codelists',
          onClick: () => {
            const cohortViewer = TwoPanelCohortViewerService.getInstance();
            cohortViewer.displayExtraContent('codelists', null);
          },
          icon: (
            <svg width="14" height="14" viewBox="0 0 48 48" fill="none" style={{ flexShrink: 0 }}>
              <path d="M14 34L34 14M34 14H14M34 14V34" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
            </svg>
          )
        },
        {
          label: 'Constants',
          onClick: () => {
            const cohortViewer = TwoPanelCohortViewerService.getInstance();
            cohortViewer.displayExtraContent('constants', null);
          },
          icon: (
            <svg width="14" height="14" viewBox="0 0 48 48" fill="none" style={{ flexShrink: 0 }}>
              <path d="M14 34L34 14M34 14H14M34 14V34" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
            </svg>
          ),
          divider: true
        },
        {
          label: 'Duplicate Cohort',
          onClick: () => console.log('Duplicate cohort'),
          disabled: true
        },
        {
          label: 'Delete Cohort',
          onClick: handleDeleteCohort,
          disabled: false
        }
      ];
    }
  };

  const rows = cohortDef.table_data.rows;

  return (
    <div className={styles.verticalCardContainer}>
      <div>
        <div 
          ref={cardRef}
          className={`${styles.cohortCard} ${(isHoveringActions || rightClickMenu !== null) ? styles.forceHover : ''} ${(isShiftPressed || isCommandPressed) ? styles.noHover : ''}`}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onContextMenu={(e) => handleContextMenu(e, null)}
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
              {isEditingTitle ? (
                <textarea
                  ref={titleInputRef}
                  value={editedTitle}
                  onChange={(e) => {
                    setEditedTitle(e.target.value);
                    // Auto-adjust height
                    if (titleInputRef.current) {
                      titleInputRef.current.style.height = 'auto';
                      titleInputRef.current.style.height = titleInputRef.current.scrollHeight + 'px';
                    }
                  }}
                  onKeyDown={handleTitleKeyDown}
                  onBlur={handleTitleSave}
                  className={styles.cohortHeaderTitleInput}
                  style={{
                    fontSize: 'var(--dynamic-font-size, 16px)',
                    height: 'auto',
                    minHeight: 'auto',
                    resize: 'none',
                    overflow: 'hidden'
                  }}
                  onClick={(e) => e.stopPropagation()}
                  rows={1}
                />
              ) : (
                <div 
                  className={styles.cohortHeaderTitle}
                  onDoubleClick={handleTitleDoubleClick}
                >
                  {cohortDef.cohort.name || 'Unnamed Cohort'}
                </div>
              )}
              <button
                className={styles.expandButton}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log("Cohort card clicked");
                  onCardClick(cohortDef);
                }}
                aria-label="Open cohort"
                style={{ fontSize: 'var(--dynamic-font-size)' , zIndex: 10000}}
              >
                <img
                  src={ArrowIcon}
                  alt="Expand"
                  className={styles.expandArrow}
                />
              </button>
            </div>
          </div>
          
          
          <div className={styles.tableContainer}>
          <div className={styles.topFiller} />
            {rows.length > 0 ? (
              <div className={styles.phenotypeList}>
                {rows.map((row, index) => (
                  <div
                    key={row.id || index}
                    onContextMenu={(e) => handleContextMenu(e, index)}
                  >
                    <CohortCardPhenotypeRow
                      row={row}
                      index={index}
                      isSelected={selectedRows.has(index)}
                      isDragging={draggedRowIndex === index}
                      isDragOver={dragOverRowIndex === index}
                      isViewportDragging={isDragging}
                      onDragStart={handleRowDragStart}
                      onDragOver={handleRowDragOver}
                      onDrop={handleRowDrop}
                      onClick={handleRowClick}
                      onExpandClick={(e) => {
                        e.stopPropagation();
                        handleRowEdit(row);
                      }}
                      onCellValueChanged={async (rowIndex, field, value) => {
                        await onCellValueChanged(cohortId, rowIndex, field, value);
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                No phenotypes found for this cohort
              </div>
            )}
          </div>
          
          {/* Actions Container */}
          {(isHovered || rightClickMenu !== null) && (
            <CohortCardActions
              ref={actionsRef}
              cohortId={cohortId}
              studyDataService={studyDataService}
              onMouseEnter={handleActionsMouseEnter}
              onMouseLeave={handleActionsMouseLeave}
            />
          )}
        </div>
        
        {/* Right Click Menu */}
        {rightClickMenu && (
          <ScaledRightClickMenu
            items={getRightClickMenuItems()}
            position={rightClickMenu.position}
            onClose={handleCloseRightClickMenu}
            zoomScale={parseFloat(getComputedStyle(cardRef.current || document.body).getPropertyValue('--zoom-scale')) || 1}
          />
        )}
      </div>
    </div>
  );
});

CohortCardLightWeight.displayName = 'CohortCardLightWeight';
