import React, { useState, useEffect } from 'react';
import styles from './StudyViewerCohortDefinitions.module.css';
import { StudyDataService } from '../StudyDataService';
import { CohortTable } from '../../CohortViewer/CohortTable/CohortTable';
import { CohortWithTableData } from './StudyViewerCohortDefinitionsTypes';

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

  return (
    <div className={styles.cohortsContainer}>
      {cohortDefinitions.map((cohortDef, index) => {
        console.log(`Cohort ${index} table data:`, cohortDef.table_data);
        console.log(`Cohort ${index} rows:`, cohortDef.table_data.rows);
        console.log(`Cohort ${index} columns:`, cohortDef.table_data.columns);
        
        return (
          <div key={cohortDef.cohort.id || index} className={styles.cohortBox}>
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
