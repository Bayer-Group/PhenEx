import React, { useEffect, useState } from 'react';
import styles from './CohortIssuesDisplay.module.css';

export interface CohortIssue {
  phenotype_id: string;
  issues: string[];
}

interface CohortIssuesDisplayProps {
  issues: CohortIssue[];
  selected?: boolean;
}

export const CohortIssuesDisplay: React.FC<CohortIssuesDisplayProps> = ({ issues, selected = false }) => {

  const totalIssueCount = (issues || []).reduce((sum, issue) => sum + issue.issues.length, 0);
  const phenotypesWithIssues = issues?.length || 0;
  const hasIssues = phenotypesWithIssues > 0;


  return (
    <div className={`${styles.row} ${selected ? styles.selected : ''}`}>
      <div className={`${styles.statusDot} ${hasIssues ? styles.red : styles.green} ${selected ? styles.selected : ''}`} />
      <span className={styles.text}>
        {hasIssues
          ? `${totalIssueCount} issues in ${phenotypesWithIssues} phenotypes`
          : 'No issues found'}
      </span>
    </div>
  );
};
