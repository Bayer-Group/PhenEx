import React from 'react';
import styles from './CohortCardLightWeight.module.css';
import { CohortWithTableData } from './StudyViewerCohortDefinitionsTypes';

interface CohortDefinitionReportProps {
  cohortDef: CohortWithTableData;
}

export const CohortDefinitionReport: React.FC<CohortDefinitionReportProps> = ({ cohortDef }) => {
  return (
    <div className={styles.phenotypeList} style={{ padding: '10px', color: 'var(--text-color)' }}>
      <h4>Report for {cohortDef.cohort.name}</h4>
      <p>Report content placeholder...</p>
      {/* Add actual report implementation here */}
    </div>
  );
};
