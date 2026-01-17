import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './StudyViewerCohortDefinitions.module.css';
import { StudyDataService } from '../StudyDataService';
import { CohortTable } from '../../CohortViewer/CohortTable/CohortTable';
import { CohortWithTableData, getStudyViewerCellRenderers } from './StudyViewerCohortDefinitionsTypes';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import { MainViewService, ViewType } from '@/views/MainView/MainView';
import { SimpleCustomScrollbar } from '@/components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import scrollbarStyles from '@/components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar.module.css';
import { deleteCohort } from '@/api/text_to_cohort/route';

import ArrowIcon from '../../../assets/icons/arrow-up-right.svg';

interface StudyViewerCohortDefinitionsProps {
  studyDataService: StudyDataService;
}

const TABLE_THEME = {
  accentColor: 'transparent',
  borderColor: 'transparent',
  rowHoverColor: 'transparent',
  wrapperBorder: false,
  headerRowBorder: false,
  columnBorder: false,
  headerFontSize: 14,
  headerFontWeight: 'bold',
  cellHorizontalPadding: 10,
  headerBackgroundColor: 'transparent',
  rowBorder: false,
  spacing: 0,
  backgroundColor: 'transparent',
  wrapperBorderRadius: 0
};

const TABLE_GRID_OPTIONS = {
  suppressRowHoverHighlight: true,
  columnHoverHighlight: false,
};

// Memoized list component to prevent re-renders during zoom/pan
const CohortList = React.memo(({ 
  cohortDefinitions, 
  openMenuId, 
  onMenuClick, 
  onDeleteClick, 
  onCardClick, 
  calculateRowHeight, 
  tableContainerRefs, 
  menuRef,
  cellRenderers,
  onCellValueChanged
}: {
  cohortDefinitions: CohortWithTableData[];
  openMenuId: string | null;
  onMenuClick: (e: React.MouseEvent, cohortId: string) => void;
  onDeleteClick: (e: React.MouseEvent, cohortDef: CohortWithTableData) => void;
  onCardClick: (cohortDef: CohortWithTableData) => void;
  calculateRowHeight: (params: any) => number;
  tableContainerRefs: React.MutableRefObject<Map<string | number, React.RefObject<HTMLDivElement | null>>>;
  menuRef: React.RefObject<HTMLDivElement>;
  cellRenderers: any;
  onCellValueChanged: (cohortId: string, event: any, selectedRows?: any[]) => Promise<void>;
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
        const isMenuOpen = openMenuId === cohortId;
        
        // Get or create ref for this cohort's card container
        if (!tableContainerRefs.current.has(cohortKey)) {
          tableContainerRefs.current.set(cohortKey, React.createRef<HTMLDivElement>());
        }

        return (
          <div key={cohortKey} className={styles.verticalCardContainer}>
            <div>
              <div 
                className={styles.cohortCard} 
                // onClick={() => onCardClick(cohortDef)}
                style={{ 
                  cursor: 'pointer', 
                  pointerEvents: 'auto',
                  '--dynamic-outline-width': 'calc(3px / var(--zoom-scale))',
                  '--dynamic-font-size': 'calc(16px / var(--zoom-scale))',
                  '--dynamic-arrow-size': 'min(75px, calc(40px / var(--zoom-scale)))'
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
                      currentlyViewing="cohort-definitions"
                      domLayout="autoHeight"
                      headerHeight={0}
                      customGetRowHeight={calculateRowHeight}
                      tableTheme={TABLE_THEME}
                      tableGridOptions={TABLE_GRID_OPTIONS}
                      components={cellRenderers}
                    />
                  ) : (
                    <div style={{ padding: '1rem', color: '#666', fontStyle: 'italic' }}>
                      No phenotypes found for this cohort
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

export const StudyViewerCohortDefinitions: React.FC<StudyViewerCohortDefinitionsProps> = ({ studyDataService }) => {
  const [cohortDefinitions, setCohortDefinitions] = useState<CohortWithTableData[] | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteConfirmCohort, setDeleteConfirmCohort] = useState<CohortWithTableData | null>(null);
  
  // Get cell renderers once - function call defers access until after module initialization
  const cellRenderers = useMemo(() => getStudyViewerCellRenderers(), []);
  
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
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const tableContainerRefs = useRef<Map<string | number, React.RefObject<HTMLDivElement | null>>>(new Map());
  const menuRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const cohortDefinitionsRef = useRef(cohortDefinitions);
  const navigate = useNavigate();

  // Update ref when cohortDefinitions changes
  useEffect(() => {
    cohortDefinitionsRef.current = cohortDefinitions;
  }, [cohortDefinitions]);

  useEffect(() => {
    // Function to update cohort definitions when study data changes
    const updateCohortDefinitions = () => {
      const definitions = studyDataService.cohort_definitions_service.getCohortDefinitions();
      setCohortDefinitions(definitions);
      console.log('Updated cohort definitions', definitions);
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
      console.log('[StudyViewer] handleCohortDataChange triggered');
      // Get which cohort was edited from the StudyDataService
      const editedCohortId = studyDataService.cohort_definitions_service.getActiveCohortId();
      // Use ref to get latest cohort definitions
      const currentDefinitions = cohortDefinitionsRef.current;
      console.log('[StudyViewer] editedCohortId:', editedCohortId, 'cohortDefinitions:', currentDefinitions?.length);
      if (!editedCohortId || !currentDefinitions) {
        console.log('[StudyViewer] Early return - no editedCohortId or cohortDefinitions');
        return;
      }

      // Check if the edited cohort is one we're displaying
      const cohortIndex = currentDefinitions.findIndex(def => def.cohort.id === editedCohortId);
      console.log('[StudyViewer] cohortIndex:', cohortIndex);
      if (cohortIndex === -1) {
        console.log('[StudyViewer] Cohort not found in definitions');
        return;
      }

      console.log('[StudyViewer] Cohort edited, refreshing card for:', editedCohortId);

      // Refresh this specific cohort's data
      const updatedDefinitions = [...currentDefinitions];
      const refreshedData = studyDataService.cohort_definitions_service.refreshSingleCohort(editedCohortId);
      
      if (refreshedData) {
        console.log('[StudyViewer] Got refreshed data, updating state');
        updatedDefinitions[cohortIndex] = refreshedData;
        setCohortDefinitions(updatedDefinitions);
      } else {
        console.warn('[StudyViewer] No refreshed data returned');
      }
    };

    console.log('[StudyViewer] Adding data change listener to CohortDataService');
    cohortDataService.addDataChangeListener(handleCohortDataChange);
    
    // Also listen to cohort_definitions_service for model changes
    console.log('[StudyViewer] Adding listener to cohort_definitions_service');
    studyDataService.cohort_definitions_service.addListener(handleCohortDataChange);

    return () => {
      console.log('[StudyViewer] Removing data change listener from CohortDataService');
      cohortDataService.removeDataChangeListener(handleCohortDataChange);
      console.log('[StudyViewer] Removing listener from cohort_definitions_service');
      studyDataService.cohort_definitions_service.removeListener(handleCohortDataChange);
    };
  }, [studyDataService]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openMenuId]);

  const handleCellValueChanged = async (cohortId: string, event: any, selectedRows?: any[]) => {
    console.log('[StudyViewer] handleCellValueChanged called for cohort:', cohortId);
    await studyDataService.cohort_definitions_service.onCellValueChanged(cohortId, event, selectedRows);
  };

  const clampViewState = (x: number, y: number, scale: number) => {
    const definitions = cohortDefinitionsRef.current;
    if (!viewportRef.current || !definitions) return { x, y };
    
    const viewportWidth = viewportRef.current.clientWidth;
    const viewportHeight = viewportRef.current.clientHeight;
    
    // Calculate content dimensions - use much larger minimums for scrollable area
    const contentWidth = Math.max(definitions.length * 420 + 40, 5000); // Minimum 5000px width
    const contentHeight = Math.max(3000, 3000); // Minimum 3000px height
    
    const scaledWidth = contentWidth * scale;
    const scaledHeight = contentHeight * scale;
    
    const padding = 200; // Increased padding for more freedom
    
    // Clamp X: keep content visible
    const minX = Math.min(viewportWidth - scaledWidth - padding, padding);
    const maxX = padding;
    const clampedX = Math.max(minX, Math.min(maxX, x));
    
    // Clamp Y: keep content visible
    const minY = Math.min(viewportHeight - scaledHeight - padding, padding);
    const maxY = padding;
    const clampedY = Math.max(minY, Math.min(maxY, y));
    
    return { x: clampedX, y: clampedY };
  };

  // Attach wheel listener with passive: false to allow preventDefault
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      console.log('viewportRef not ready');
      return;
    }

    console.log('Attaching wheel listener to:', element);

    // Cache dimensions once to avoid layout reads during scroll
    const centerX = element.clientWidth / 2;
    const centerY = element.clientHeight / 2;

    const wheelHandler = (e: WheelEvent) => {
      e.preventDefault();

      const isShift = e.shiftKey;
      const isCommand = e.metaKey || e.ctrlKey;

      if (isCommand) {
        // Zoom to cached center point (no layout reads)
        const zoomSpeed = 0.01;
        const delta = -e.deltaY * zoomSpeed;
        setViewState(prev => {
          const newScale = Math.max(0.3, Math.min(1, prev.scale * (1 + delta)));
          const pointX = (centerX - prev.x) / prev.scale;
          const pointY = (centerY - prev.y) / prev.scale;
          const newX = centerX - pointX * newScale;
          const newY = centerY - pointY * newScale;
          return { x: newX, y: newY, scale: newScale };
        });
      } else if (isShift) {
        // Horizontal pan
        // Use deltaX if available (browser handled shift), fallback to deltaY
        const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
        setViewState(prev => ({
          x: prev.x - delta,
          y: prev.y,
          scale: prev.scale
        }));
      } else {
        // Vertical pan
        setViewState(prev => ({
          x: prev.x,
          y: prev.y - e.deltaY,
          scale: prev.scale
        }));
      }
    };

    element.addEventListener('wheel', wheelHandler, { passive: false });
    console.log('Wheel listener attached');
    return () => {
      console.log('Removing wheel listener');
      element.removeEventListener('wheel', wheelHandler);
    };
  }, [cohortDefinitions]); // Re-run when cohortDefinitions loads (so viewport is rendered)

  const handleCreateFirstCohort = async () => {
    try {
      const studyId = studyDataService.study_data?.id;
      
      if (!studyId) {
        console.error('No study ID found');
        return;
      }

      // Use centralized helper to ensure consistent behavior
      const { createAndNavigateToNewCohort } = await import('@/views/LeftPanel/studyNavigationHelpers');
      await createAndNavigateToNewCohort(studyId, navigate);
    } catch (error) {
      console.error('Failed to create cohort:', error);
    }
  };

  const clickedOnCohort = React.useCallback((cohortDef: CohortWithTableData) => {
    console.log('Clicked on cohort:', cohortDef);
    
    // Get study ID from the cohort or from studyDataService
    const studyId = cohortDef.cohort.study_id || studyDataService.study_data?.id;
    const cohortId = cohortDef.cohort.id;
    
    if (studyId && cohortId) {
      // Navigate using URL
      navigate(`/studies/${studyId}/cohorts/${cohortId}`);
    } else {
      console.error('Missing study_id or cohort_id for navigation');
    }
  }, [studyDataService.study_data?.id, navigate]);

  const handleMenuClick = React.useCallback((e: React.MouseEvent, cohortId: string) => {
    e.stopPropagation(); // Prevent card click
    setOpenMenuId(prev => prev === cohortId ? null : cohortId);
  }, []);

  const handleDeleteClick = React.useCallback((e: React.MouseEvent, cohortDef: CohortWithTableData) => {
    e.stopPropagation(); // Prevent card click
    setDeleteConfirmCohort(cohortDef);
    setOpenMenuId(null);
  }, []);

  const handleConfirmDelete = async () => {
    if (!deleteConfirmCohort) return;
    
    try {
      await deleteCohort(deleteConfirmCohort.cohort.id);
      
      console.log('🗑️ Cohort deleted, clearing cache and notifying listeners');
      
      // Refresh cohort definitions by reloading study data
      const studyId = studyDataService.study_data?.id;
      if (studyId) {
        const CohortsDataService = (await import('@/views/LeftPanel/CohortsDataService')).CohortsDataService;
        const cohortsDataService = CohortsDataService.getInstance();
        
        // Force cache refresh - clear all relevant caches
        // @ts-ignore
        cohortsDataService._userStudies = null;
        // @ts-ignore
        cohortsDataService._publicStudies = null;
        // @ts-ignore - Clear the study cohorts cache for this specific study
        if (cohortsDataService._studyCohortsCache) {
          // @ts-ignore
          cohortsDataService._studyCohortsCache.delete(studyId);
        }
        
        // Notify listeners to trigger left panel update
        // @ts-ignore - accessing private method to force notification
        cohortsDataService.notifyListeners();
        
        const cohorts = await cohortsDataService.getCohortsForStudy(studyId);
        const studyData = { ...studyDataService.study_data, cohorts };
        studyDataService.loadStudyData(studyData);
      }
      
      setDeleteConfirmCohort(null);
    } catch (error) {
      console.error('Failed to delete cohort:', error);
      alert('Failed to delete cohort. Please try again.');
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmCohort(null);
  };

  const calculateRowHeight = React.useCallback((params: any) => {
    let current_max_height = 20;
    const minHeight = 20; 

    const nameCol = params.api.getColumnDef('name');
    if (!nameCol || !params.data?.name) return minHeight; // Increased minimum height
    const nameWidth = (nameCol.width) || 200;
    const nameCharPerLine = Math.floor(nameWidth / 8);
    const nameLines = Math.ceil(params.data?.name.length / nameCharPerLine);
    const nameHeight = nameLines * 22 + 10; // 14px per line + padding
    if (!params.data?.description) {
      return Math.max(current_max_height, nameHeight); // Increased minimum height
    }
    const descriptionLines = params.data.description.split('\n').length;
    if (descriptionLines.length === 1) {
      return Math.max(current_max_height, nameHeight); // Increased minimum height
    }
    const descriptionHeight = descriptionLines * 20 + 5; // 12px per line + padding
    current_max_height = Math.max(current_max_height, nameHeight+descriptionHeight);
    
    return current_max_height; // Increased minimum height
  
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // With pointer-events:none on transform container, clicks on background reach here
    // Cards have pointer-events:auto so they won't trigger this
    setIsDragging(true);
    setDragStart({ x: e.clientX - viewState.x, y: e.clientY - viewState.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      const clamped = clampViewState(newX, newY, viewState.scale);
      setViewState(prev => ({
        ...prev,
        x: clamped.x,
        y: clamped.y
      }));
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
            openMenuId={openMenuId}
            onMenuClick={handleMenuClick}
            onDeleteClick={handleDeleteClick}
            onCardClick={clickedOnCohort}
            calculateRowHeight={calculateRowHeight}
            tableContainerRefs={tableContainerRefs}
            menuRef={menuRef}
            cellRenderers={cellRenderers}
            onCellValueChanged={handleCellValueChanged}
          />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmCohort && (
        <div className={styles.modalOverlay} onClick={handleCancelDelete}>
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
              <button className={styles.alertCancelButton} onClick={handleCancelDelete}>
                Cancel
              </button>
              <button className={styles.alertDeleteButton} onClick={handleConfirmDelete}>
                Delete Cohort
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
