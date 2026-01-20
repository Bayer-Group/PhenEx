import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './StudyViewerCohortDefinitions.module.css';
import { StudyDataService } from '../StudyDataService';
import { CohortWithTableData } from './StudyViewerCohortDefinitionsTypes';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import { deleteCohort } from '@/api/text_to_cohort/route';
import { CohortCardLightWeight } from './CohortCardLightWeight';

interface StudyViewerCohortDefinitionsLightWeightProps {
  studyDataService: StudyDataService;
}

// Memoized list component to prevent re-renders during zoom/pan
const CohortList = React.memo(({
  cohortDefinitions,
  onCardClick,
  tableContainerRefs,
  onCellValueChanged,
  onRowDragStart,
  onRowDragOver,
  onRowDrop,
  studyDataService,
  isDragging,
  isScrolling,
  isShiftPressed,
  isCommandPressed,
}: {
  cohortDefinitions: CohortWithTableData[];
  onCardClick: (cohortDef: CohortWithTableData) => void;
  tableContainerRefs: React.MutableRefObject<Map<string | number, React.RefObject<HTMLDivElement | null>>>;
  onCellValueChanged: (cohortId: string, rowIndex: number, field: string, value: any) => Promise<void>;
  onRowDragStart: (rowIndex: number) => void;
  onRowDragOver: (rowIndex: number) => void;
  onRowDrop: (cohortId: string) => Promise<void>;
  studyDataService: any;
  isDragging: boolean;
  isScrolling: boolean;
  isShiftPressed: boolean;
  isCommandPressed: boolean;
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '40px',
        padding: '20px',
        pointerEvents: 'none'
      }}
    >
      {cohortDefinitions.map((cohortDef, index) => {
        const cohortKey = cohortDef.cohort.id || index;
        const cohortId = cohortDef.cohort.id || String(index);
        
        // Get or create ref for this cohort's card container
        if (!tableContainerRefs.current.has(cohortKey)) {
          tableContainerRefs.current.set(cohortKey, React.createRef<HTMLDivElement>());
        }

        return (
          <CohortCardLightWeight
            key={cohortKey}
            cohortDef={cohortDef}
            cohortId={cohortId}
            studyDataService={studyDataService}
            onCardClick={onCardClick}
            onCellValueChanged={onCellValueChanged}
            onRowDragStart={onRowDragStart}
            onRowDragOver={onRowDragOver}
            onRowDrop={onRowDrop}
            isDragging={isDragging}
            isScrolling={isScrolling}
            isShiftPressed={isShiftPressed}
            isCommandPressed={isCommandPressed}
          />
        );
      })}
    </div>
  );
});

export const StudyViewerCohortDefinitionsLightWeight: React.FC<StudyViewerCohortDefinitionsLightWeightProps> = ({ studyDataService }) => {
  const [cohortDefinitions, setCohortDefinitions] = useState<CohortWithTableData[] | null>(null);
  const [deleteConfirmCohort, setDeleteConfirmCohort] = useState<CohortWithTableData | null>(null);
  
  // Initialize view state from local storage if available
  const [viewState, setViewState] = useState(() => {
    const studyId = studyDataService.study_data?.id;
    if (studyId) {
      try {
        const saved = localStorage.getItem(`cohort-view-state-${studyId}`);
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse saved view state', e);
      }
    }
    return { x: 0, y: 0, scale: 1 };
  });

  // Persist view state changes to local storage (debounced)
  useEffect(() => {
    const studyId = studyDataService.study_data?.id;
    if (!studyId) return;

    const timeoutId = setTimeout(() => {
      localStorage.setItem(`cohort-view-state-${studyId}`, JSON.stringify(viewState));
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [viewState, studyDataService.study_data?.id]);

  const [isDragging, setIsDragging] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isCommandPressed, setIsCommandPressed] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedRow, setDraggedRow] = useState<number | null>(null);
  const [dragOverRow, setDragOverRow] = useState<number | null>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tableContainerRefs = useRef<Map<string | number, React.RefObject<HTMLDivElement | null>>>(new Map());
  const viewportRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<HTMLDivElement>(null);
  const cohortDefinitionsRef = useRef(cohortDefinitions);
  const navigate = useNavigate();
  
  // Current transform values (ref to avoid re-renders)
  const currentTransform = useRef(viewState);
  const persistTimeout = useRef<NodeJS.Timeout | null>(null);

  // Update ref when cohortDefinitions changes
  useEffect(() => {
    cohortDefinitionsRef.current = cohortDefinitions;
  }, [cohortDefinitions]);

  // Track shift key state globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }
      if (e.key === 'Meta' || e.key === 'Control') {
        setIsCommandPressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
      if (e.key === 'Meta' || e.key === 'Control') {
        setIsCommandPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  // Helper to update transform directly on DOM
  const applyTransform = (x: number, y: number, scale: number) => {
    if (transformRef.current) {
      transformRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      // @ts-ignore
      transformRef.current.style.setProperty('--zoom-scale', scale.toString());
    }
    currentTransform.current = { x, y, scale };
    
    // Debounce persist to localStorage
    if (persistTimeout.current) clearTimeout(persistTimeout.current);
    persistTimeout.current = setTimeout(() => {
      setViewState({ x, y, scale });
    }, 500);
  };

  useEffect(() => {
    // Function to update cohort definitions when study data changes
    const updateCohortDefinitions = () => {
      const definitions = studyDataService.cohort_definitions_service.getCohortDefinitions();
      setCohortDefinitions(definitions);
    };

    // Initial load
    updateCohortDefinitions();

    // Listen for study data service changes
    studyDataService.addStudyDataServiceListener(updateCohortDefinitions);

    // Cleanup listener on unmount
    return () => {
      studyDataService.removeStudyDataServiceListener(updateCohortDefinitions);
    };
  }, [studyDataService]);

  // Listen to singleton CohortDataService for real-time updates when editing cohorts
  useEffect(() => {
    const cohortDataService = CohortDataService.getInstance();

    const handleCohortDataChange = () => {
      const editedCohortId = studyDataService.cohort_definitions_service.getActiveCohortId();
      const currentDefinitions = cohortDefinitionsRef.current;
      if (!editedCohortId || !currentDefinitions) return;

      const cohortIndex = currentDefinitions.findIndex(def => def.cohort.id === editedCohortId);
      if (cohortIndex === -1) return;

      const updatedDefinitions = [...currentDefinitions];
      const refreshedData = studyDataService.cohort_definitions_service.refreshSingleCohort(editedCohortId);
      
      if (refreshedData) {
        updatedDefinitions[cohortIndex] = refreshedData;
        setCohortDefinitions(updatedDefinitions);
      }
    };

    cohortDataService.addDataChangeListener(handleCohortDataChange);
    studyDataService.cohort_definitions_service.addListener(handleCohortDataChange);

    return () => {
      cohortDataService.removeDataChangeListener(handleCohortDataChange);
      studyDataService.cohort_definitions_service.removeListener(handleCohortDataChange);
    };
  }, [studyDataService]);

  const handleCellValueChanged = async (cohortId: string, rowIndex: number, field: string, value: any) => {
    console.log(`Cell changed: cohort=${cohortId}, row=${rowIndex}, field=${field}, value=${value}`);
    
    // Get the cohort definition
    const cohortDef = cohortDefinitionsRef.current?.find(def => def.cohort.id === cohortId);
    if (!cohortDef) {
      console.warn('Cohort not found:', cohortId);
      return;
    }

    // Get the row data
    const rowData = cohortDef.table_data.rows[rowIndex];
    if (!rowData) {
      console.warn('Row not found:', rowIndex);
      return;
    }

    // Create an AG Grid-like event object
    const event = {
      data: rowData,
      newValue: value,
      oldValue: rowData[field],
      colDef: { field },
      node: { rowIndex }
    };

    // Call the service to update the model
    await studyDataService.cohort_definitions_service.onCellValueChanged(cohortId, event);
  };

  const handleRowDragStart = (rowIndex: number) => {
    setDraggedRow(rowIndex);
  };

  const handleRowDragOver = (rowIndex: number) => {
    setDragOverRow(rowIndex);
  };

  const handleRowDrop = async (cohortId: string) => {
    if (draggedRow === null || dragOverRow === null || draggedRow === dragOverRow) {
      setDraggedRow(null);
      setDragOverRow(null);
      return;
    }

    // Reorder rows
    const currentDefinitions = cohortDefinitionsRef.current;
    if (!currentDefinitions) return;

    const cohortIndex = currentDefinitions.findIndex(def => def.cohort.id === cohortId);
    if (cohortIndex === -1) return;

    const cohortDef = currentDefinitions[cohortIndex];
    const newRows = [...cohortDef.table_data.rows];
    const [removed] = newRows.splice(draggedRow, 1);
    newRows.splice(dragOverRow, 0, removed);

    // Update state
    const updatedDefinitions = [...currentDefinitions];
    updatedDefinitions[cohortIndex] = {
      ...cohortDef,
      table_data: {
        ...cohortDef.table_data,
        rows: newRows
      }
    };
    setCohortDefinitions(updatedDefinitions);

    // Call service to persist
    await studyDataService.cohort_definitions_service.onRowDragEnd(cohortId, newRows);

    setDraggedRow(null);
    setDragOverRow(null);
  };

  // Attach wheel listener - directly manipulate DOM, no React re-renders
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const centerX = element.clientWidth / 2;
    const centerY = element.clientHeight / 2;

    const wheelHandler = (e: WheelEvent) => {
      e.preventDefault();

      // Mark as scrolling to prevent hover
      setIsScrolling(true);
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);

      const current = currentTransform.current;
      const isShift = e.shiftKey;
      const isCommand = e.metaKey || e.ctrlKey;

      if (isCommand) {
        // Zoom
        const zoomSpeed = 0.01;
        const delta = -e.deltaY * zoomSpeed;
        const newScale = Math.max(0.3, Math.min(1, current.scale * (1 + delta)));
        const pointX = (centerX - current.x) / current.scale;
        const pointY = (centerY - current.y) / current.scale;
        const newX = centerX - pointX * newScale;
        const newY = centerY - pointY * newScale;
        applyTransform(newX, newY, newScale);
      } else if (isShift) {
        // Horizontal pan
        const deltaX = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        applyTransform(current.x - deltaX, current.y, current.scale);
      } else {
        // Vertical pan
        const deltaY = e.deltaY;
        applyTransform(current.x, current.y - deltaY, current.scale);
      }
    };

    element.addEventListener('wheel', wheelHandler, { passive: false });
    return () => {
      element.removeEventListener('wheel', wheelHandler);
      if (persistTimeout.current) clearTimeout(persistTimeout.current);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [cohortDefinitions]);

  const handleCreateFirstCohort = async () => {
    try {
      const studyId = studyDataService.study_data?.id;
      
      if (!studyId) {
        console.error('No study ID found');
        return;
      }

      const { createAndNavigateToNewCohort } = await import('@/views/LeftPanel/studyNavigationHelpers');
      await createAndNavigateToNewCohort(studyId, navigate);
    } catch (error) {
      console.error('Failed to create cohort:', error);
    }
  };

  const clickedOnCohort = React.useCallback((cohortDef: CohortWithTableData) => {
    const studyId = cohortDef.cohort.study_id || studyDataService.study_data?.id;
    const cohortId = cohortDef.cohort.id;
    
    if (studyId && cohortId) {
      navigate(`/studies/${studyId}/cohorts/${cohortId}`);
    } else {
      console.error('Missing study_id or cohort_id for navigation');
    }
  }, [studyDataService.study_data?.id, navigate]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - viewState.x, y: e.clientY - viewState.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      applyTransform(newX, newY, currentTransform.current.scale);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // Show loading state or empty state when data is not ready
  if (!cohortDefinitions || cohortDefinitions.length === 0) {
    if (cohortDefinitions === null) {
      return (
        <div className={styles.cohortsContainer}>
          <div className={styles.emptyState}>
            Loading cohort definitions...
          </div>
        </div>
      );
    }
    
    // Empty state with CTA
    return (
      <div className={styles.cohortsContainer}>
        <div className={styles.emptyStateWithCta}>
          <div className={styles.ctaContent}>
            <h3 className={styles.ctaTitle}>Create your first cohort</h3>
            <p className={styles.ctaDescription}>
              Define patient populations by adding inclusion and exclusion criteria to build your cohort.
            </p>
            <button 
              className={styles.ctaButton}
              onClick={handleCreateFirstCohort}
            >
              Create Your First Cohort
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div 
        ref={viewportRef}
        className={styles.content}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ 
          overflow: 'hidden',
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none'
        }}
      >
        <div
          ref={transformRef}
          style={{
            transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})`,
            transformOrigin: '0 0',
            transition: 'none',
            // @ts-ignore
            '--zoom-scale': viewState.scale
          }}
        >
          <CohortList 
            cohortDefinitions={cohortDefinitions}
            onCardClick={clickedOnCohort}
            tableContainerRefs={tableContainerRefs}
            onCellValueChanged={handleCellValueChanged}
            onRowDragStart={handleRowDragStart}
            onRowDragOver={handleRowDragOver}
            onRowDrop={handleRowDrop}
            studyDataService={studyDataService}
            isDragging={isDragging}
            isScrolling={isScrolling}
            isShiftPressed={isShiftPressed}
            isCommandPressed={isCommandPressed}
          />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmCohort && (
        <div className={styles.modalOverlay} onClick={() => setDeleteConfirmCohort(null)}>
          <div className={styles.alertModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.alertIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className={styles.alertTitle}>Delete Cohort?</h3>
            <p className={styles.alertMessage}>
              Are you sure you want to delete <strong>"{deleteConfirmCohort.cohort.name || 'Unnamed Cohort'}"</strong>?
            </p>
            <p className={styles.alertWarning}>
              This action cannot be undone. All cohort definitions and criteria will be permanently deleted.
            </p>
            <div className={styles.alertActions}>
              <button className={styles.alertCancelButton} onClick={() => setDeleteConfirmCohort(null)}>
                Cancel
              </button>
              <button className={styles.alertDeleteButton} onClick={async () => {
                if (deleteConfirmCohort) {
                  await deleteCohort(deleteConfirmCohort.cohort.id);
                  setDeleteConfirmCohort(null);
                }
              }}>
                Delete Cohort
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
