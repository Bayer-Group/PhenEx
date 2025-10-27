import React from 'react';
import styles from './StudyViewerCohortDefinitions.module.css';
import { StudyDataService } from '../StudyDataService';

interface StudyViewerCohortDefinitionsProps {
  studyDataService: StudyDataService;
}

export const StudyViewerCohortDefinitions: React.FC<StudyViewerCohortDefinitionsProps> = ({ studyDataService }) => {
  const cohorts = studyDataService.cohort_definitions_service.getCohorts();

  return (
    <div className={styles.cohortsContainer}>
      {cohorts.map((cohort, index) => (
        <div key={cohort.id || index} className={styles.cohortBox}>
          {cohort.name || 'Unnamed Cohort'}
        </div>
      ))}
    </div>
  );
};
