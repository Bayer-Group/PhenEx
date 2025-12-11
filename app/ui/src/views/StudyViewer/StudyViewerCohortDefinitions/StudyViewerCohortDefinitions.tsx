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
  const tableContainerRefs = useRef<Map<string | number, React.RefObject<HTMLDivElement | null>>>(new Map());
  const menuRef = useRef<HTMLDivElement>(null);
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

  const renderCohortCard = (cohortDef: CohortWithTableData, index: number) => {
    const cohortKey = cohortDef.cohort.id || index;
    const cohortId = cohortDef.cohort.id || String(index);
    const isMenuOpen = openMenuId === cohortId;

    return (
      <div 
        key={cohortKey} 
        className={styles.cohortCard} 
        onClick={() => clickedOnCohort(cohortDef)}
        onWheel={(e) => {
          // When mouse is over the card, stop propagation to allow card container scrolling
          e.stopPropagation();
        }}
      >
        <div className={styles.cohortHeader}>
          <div className={styles.cohortHeaderContent}>
            <div className={styles.cohortHeaderTitle}>
              {cohortDef.cohort.name || 'Unnamed Cohort'}
              <div style={{ fontSize: '12px', color: '#666' }}>
                ({cohortDef.table_data.rows.length} rows)
              </div>
            </div>
            <div className={styles.menuContainer} ref={isMenuOpen ? menuRef : null}>
              <button
                className={styles.menuButton}
                onClick={(e) => handleMenuClick(e, cohortId)}
                aria-label="Cohort options"
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                  <circle cx="10" cy="4" r="1.5" />
                  <circle cx="10" cy="10" r="1.5" />
                  <circle cx="10" cy="16" r="1.5" />
                </svg>
              </button>
              {isMenuOpen && (
                <div className={styles.menuDropdown}>
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
    const cardContainerRef = tableContainerRefs.current.get(cohortKey)!;

    return (
      <div key={cohortKey} className={styles.verticalCardContainer}>
        <div 
          ref={cardContainerRef}
          className={`${styles.verticalCardContainerForScrolling} ${scrollbarStyles.hideScrollbars}`}
        >
          {renderCohortCard(cohortDef, index)}
        </div>
        <SimpleCustomScrollbar
          targetRef={cardContainerRef}
          orientation="vertical"
          marginTop={200}
          marginBottom={600}
          marginToEnd={0}
        />
      </div>
    );
  }

  return (
    <>
      <div 
        className={styles.content}
        onWheel={(e) => {
          // Translate vertical scroll to horizontal scroll on the container
          const container = e.currentTarget;
          if (container && Math.abs(e.deltaY) > 0) {
            e.preventDefault();
            container.scrollLeft += e.deltaY;
          }
        }}
      >
        {cohortDefinitions.map((cohortDef, index) => renderCohortCardContainer(cohortDef, index))}
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
