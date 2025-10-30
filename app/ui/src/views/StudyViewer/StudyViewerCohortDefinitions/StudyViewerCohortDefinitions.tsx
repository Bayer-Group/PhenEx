import React, { useState, useEffect } from 'react';
import styles from './StudyViewerCohortDefinitions.module.css';
import { StudyDataService } from '../StudyDataService';
import { CohortTable } from '../../CohortViewer/CohortTable/CohortTable';
import { CohortWithTableData } from './StudyViewerCohortDefinitionsTypes';
import { MainViewService, ViewType } from '@/views/MainView/MainView';

interface StudyViewerCohortDefinitionsProps {
  studyDataService: StudyDataService;
}

export const StudyViewerCohortDefinitions: React.FC<StudyViewerCohortDefinitionsProps> = ({ studyDataService }) => {
  const [cohortDefinitions, setCohortDefinitions] = useState<CohortWithTableData[] | null>(null);

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
        const mainViewService = MainViewService.getInstance();
        mainViewService.navigateTo({viewType: ViewType.CohortDefinition, data: cohortDef.cohort});
  };

  return (
    <div className={styles.cohortsContainer}>
      {cohortDefinitions.map((cohortDef, index) => {
        console.log(`Cohort ${index} table data:`, cohortDef.table_data);
        console.log(`Cohort ${index} rows:`, cohortDef.table_data.rows);
        console.log(`Cohort ${index} columns:`, cohortDef.table_data.columns);
        
        return (
          <div key={cohortDef.cohort.id || index} className={styles.cohortBox} onClick={() => clickedOnCohort(cohortDef)}>
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

                    // browserColorScheme: 'light',
                    columnBorder: false,
                    headerFontSize: 14,
                    headerFontWeight: 'bold',
                    // headerRowBorder: true,
                    cellHorizontalPadding: 10,
                    headerBackgroundColor: 'transparent',
                    rowBorder: false,
                    spacing: 8,
                    backgroundColor: 'transparent',
                  }}
                  tableGridOptions={{
                      // turns OFF row hover, it's on by default
                      suppressRowHoverHighlight: true,
                      // turns ON column hover, it's off by default
                      columnHoverHighlight: false,
                      // other grid options ...
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
      })}
    </div>
  );
};
