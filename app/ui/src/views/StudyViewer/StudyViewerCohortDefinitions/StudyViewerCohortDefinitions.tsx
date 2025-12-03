import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './StudyViewerCohortDefinitions.module.css';
import { StudyDataService } from '../StudyDataService';
import { CohortTable } from '../../CohortViewer/CohortTable/CohortTable';
import { CohortWithTableData } from './StudyViewerCohortDefinitionsTypes';
import { MainViewService, ViewType } from '@/views/MainView/MainView';
import { SimpleCustomScrollbar } from '@/components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import scrollbarStyles from '@/components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar.module.css';

interface StudyViewerCohortDefinitionsProps {
  studyDataService: StudyDataService;
}

export const StudyViewerCohortDefinitions: React.FC<StudyViewerCohortDefinitionsProps> = ({ studyDataService }) => {
  const [cohortDefinitions, setCohortDefinitions] = useState<CohortWithTableData[] | null>(null);
  const tableContainerRefs = useRef<Map<string | number, React.RefObject<HTMLDivElement | null>>>(new Map());
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

  // Show loading state or empty state when data is not ready
  if (!cohortDefinitions || cohortDefinitions.length === 0) {
    return (
      <div className={styles.cohortsContainer}>
        <div className={styles.emptyState}>
          {cohortDefinitions === null ? 'Loading cohort definitions...' : 'No cohort definitions available'}
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
      // Fallback to old navigation
      const mainViewService = MainViewService.getInstance();
      mainViewService.navigateTo({viewType: ViewType.CohortDefinition, data: cohortDef.cohort});
    }
  };

  const renderCohortCard = (cohortDef: CohortWithTableData, index: number) => {
    const cohortKey = cohortDef.cohort.id || index;

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
          {cohortDef.cohort.name || 'Unnamed Cohort'}
          <div style={{ fontSize: '12px', color: '#666' }}>
            ({cohortDef.table_data.rows.length} rows)
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
  );
};
