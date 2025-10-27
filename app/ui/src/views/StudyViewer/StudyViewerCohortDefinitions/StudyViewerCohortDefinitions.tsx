import React from 'react';
import styles from './StudyViewerCohortDefinitions.module.css';
import { StudyDataService } from '../StudyDataService';
import { CohortTable } from '../../CohortViewer/CohortTable/CohortTable';

interface StudyViewerCohortDefinitionsProps {
  studyDataService: StudyDataService;
}

export const StudyViewerCohortDefinitions: React.FC<StudyViewerCohortDefinitionsProps> = ({ studyDataService }) => {
  const cohortDefinitions = studyDataService.cohort_definitions_service.getCohortDefinitions();

  return (
    <div className={styles.cohortsContainer}>
      {cohortDefinitions.map((cohortDef, index) => (
        <div key={cohortDef.cohort.id || index} className={styles.cohortBox}>
          <div className={styles.cohortHeader}>
            {cohortDef.cohort.name || 'Unnamed Cohort'}
          </div>
          <div className={styles.tableContainer}>
            <CohortTable
              data={cohortDef.table_data}
              onCellValueChanged={() => {}}
              currentlyViewing="cohort-definitions"
            />
          </div>
        </div>
      ))}
    </div>
  );
};
