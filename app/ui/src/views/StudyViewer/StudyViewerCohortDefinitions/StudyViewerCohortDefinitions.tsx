import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './StudyViewerCohortDefinitions.module.css';
import { StudyDataService } from '../StudyDataService';
import { CohortTable } from '../../CohortViewer/CohortTable/CohortTable';
import { CohortWithTableData } from './StudyViewerCohortDefinitionsTypes';
import { MainViewService, ViewType } from '@/views/MainView/MainView';
import { SimpleCustomScrollbar } from '@/components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import scrollbarStyles from '@/components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar.module.css';
import { deleteCohort } from '@/api/text_to_cohort/route';

interface StudyViewerCohortDefinitionsProps {
  studyDataService: StudyDataService;
}

export const StudyViewerCohortDefinitions: React.FC<StudyViewerCohortDefinitionsProps> = ({ studyDataService }) => {
  const [cohortDefinitions, setCohortDefinitions] = useState<CohortWithTableData[] | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteConfirmCohort, setDeleteConfirmCohort] = useState<CohortWithTableData | null>(null);
  const [viewState, setViewState] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const tableContainerRefs = useRef<Map<string | number, React.RefObject<HTMLDivElement | null>>>(new Map());
  const menuRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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

  const clampViewState = (x: number, y: number, scale: number) => {
    if (!viewportRef.current || !cohortDefinitions) return { x, y };
    
    const viewportWidth = viewportRef.current.clientWidth;
    const viewportHeight = viewportRef.current.clientHeight;
    
    // Calculate content dimensions - use much larger minimums for scrollable area
    const contentWidth = Math.max(cohortDefinitions.length * 420 + 40, 5000); // Minimum 5000px width
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
    if (!element) return;

    const wheelHandler = (e: WheelEvent) => {
      e.preventDefault();

      const isShift = e.shiftKey;
      const isCommand = e.metaKey || e.ctrlKey;

      if (isCommand) {
        // Zoom
        const zoomSpeed = 0.01;
        const delta = -e.deltaY * zoomSpeed;
        setViewState(prev => {
          const newScale = Math.max(0.3, Math.min(1, prev.scale * (1 + delta)));
          const rect = element.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          const pointX = (mouseX - prev.x) / prev.scale;
          const pointY = (mouseY - prev.y) / prev.scale;
          const newX = mouseX - pointX * newScale;
          const newY = mouseY - pointY * newScale;
          const clamped = clampViewState(newX, newY, newScale);
          return { x: clamped.x, y: clamped.y, scale: newScale };
        });
      } else if (isShift) {
        // Horizontal pan
        setViewState(prev => {
          const newX = prev.x - e.deltaY;
          const clamped = clampViewState(newX, prev.y, prev.scale);
          return { ...prev, x: clamped.x };
        });
      } else {
        // Vertical pan
        setViewState(prev => {
          const newY = prev.y - e.deltaY;
          const clamped = clampViewState(prev.x, newY, prev.scale);
          return { ...prev, y: clamped.y };
        });
      }
    };

    element.addEventListener('wheel', wheelHandler, { passive: false });
    return () => element.removeEventListener('wheel', wheelHandler);
  }, [cohortDefinitions]);

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

  const handleMenuClick = (e: React.MouseEvent, cohortId: string) => {
    e.stopPropagation(); // Prevent card click
    setOpenMenuId(openMenuId === cohortId ? null : cohortId);
  };

  const handleDeleteClick = (e: React.MouseEvent, cohortDef: CohortWithTableData) => {
    e.stopPropagation(); // Prevent card click
    setDeleteConfirmCohort(cohortDef);
    setOpenMenuId(null);
  };

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
  const clickedOnCohort = (cohortDef: CohortWithTableData) => {
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
  };

  const calculateRowHeight = (params: any) => {
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
  
  }

  const renderCohortCard = (cohortDef: CohortWithTableData, index: number) => {
    const cohortKey = cohortDef.cohort.id || index;
    const cohortId = cohortDef.cohort.id || String(index);
    const isMenuOpen = openMenuId === cohortId;

    // Calculate outline width to maintain visual 3px regardless of scale
    const desiredVisualOutlineWidth = 3;
    const actualOutlineWidth = desiredVisualOutlineWidth / viewState.scale;

    // Calculate font size to maintain visual 16px regardless of scale
    const desiredVisualFontSize = 16;
    const actualFontSize = desiredVisualFontSize / viewState.scale;

    return (
      <div 
        key={cohortKey} 
        className={styles.cohortCard} 
        onClick={() => clickedOnCohort(cohortDef)}
        style={{ 
          cursor: 'pointer', 
          pointerEvents: 'auto',
          '--dynamic-outline-width': `${actualOutlineWidth}px`,
          '--dynamic-font-size': `${actualFontSize}px`
        } as React.CSSProperties & { '--dynamic-outline-width': string; '--dynamic-font-size': string }}
      >
        <div className={styles.cohortHeader} style={{ 
          position: 'absolute', 
          bottom: '100%', 
          left: '0', 
          right: '0',
          fontSize: `${actualFontSize}px`
        }}>
          <div className={styles.cohortHeaderContent}>
            <div className={styles.cohortHeaderTitle}>
              {cohortDef.cohort.name || 'Unnamed Cohort'}
            </div>
            <div className={styles.menuContainer} ref={isMenuOpen ? menuRef : null}>
              <button
                className={styles.menuButton}
                onClick={(e) => handleMenuClick(e, cohortId)}
                aria-label="Cohort options"
                style={{ fontSize: `${actualFontSize}px` }}
              >
                <svg width={actualFontSize} height={actualFontSize} viewBox="0 0 20 20" fill="currentColor">
                  <circle cx="10" cy="4" r="1.5" />
                  <circle cx="10" cy="10" r="1.5" />
                  <circle cx="10" cy="16" r="1.5" />
                </svg>
              </button>
              {isMenuOpen && (
                <div className={styles.menuDropdown} style={{ fontSize: `${actualFontSize}px` }}>
                  <button
                    className={styles.menuItem}
                    onClick={(e) => handleDeleteClick(e, cohortDef)}
                  >
                    Delete Cohort
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className={styles.tableContainer}>
          {cohortDef.table_data.rows.length > 0 ? (
            <CohortTable
              data={cohortDef.table_data}
              onCellValueChanged={() => {}}
              currentlyViewing="cohort-definitions"
              domLayout="autoHeight"
              headerHeight={0}
              customGetRowHeight={calculateRowHeight}
              tableTheme={{
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
                spacing: 8,
                backgroundColor: 'transparent',
                wrapperBorderRadius: 0
              }}
              tableGridOptions={{
                suppressRowHoverHighlight: true,
                columnHoverHighlight: false,
              }}
            />
          ) : (
            <div style={{ padding: '1rem', color: '#666', fontStyle: 'italic' }}>
              No phenotypes found for this cohort
            </div>
          )}
        </div>
      </div>
    );
  }

  const renderCohortCardContainer = (cohortDef: CohortWithTableData, index: number) => {
    const cohortKey = cohortDef.cohort.id || index;
    
    // Get or create ref for this cohort's card container
    if (!tableContainerRefs.current.has(cohortKey)) {
      tableContainerRefs.current.set(cohortKey, React.createRef<HTMLDivElement>());
    }
    // const cardContainerRef = tableContainerRefs.current.get(cohortKey)!;

    return (
      <div key={cohortKey} className={styles.verticalCardContainer}>
        <div 
          // ref={cardContainerRef}
          // className={`${styles.verticalCardContainerForScrolling} ${scrollbarStyles.hideScrollbars}`}
        >
          {renderCohortCard(cohortDef, index)}
        </div>
        {/* <SimpleCustomScrollbar
          targetRef={cardContainerRef}
          orientation="vertical"
          marginTop={200}
          marginBottom={600}
          marginToEnd={0}
        /> */}
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
            display: 'flex',
            flexDirection: 'row',
            gap: '40px',
            padding: '20px',
            pointerEvents: 'none'
          }}
        >
          {cohortDefinitions.map((cohortDef, index) => renderCohortCardContainer(cohortDef, index))}
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
