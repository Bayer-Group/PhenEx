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

export const CohortIssuesDisplay: React.FC<CohortIssuesDisplayProps> = ({
  issues,
  selected = false,
}) => {
  const totalIssueCount = (issues || []).reduce((sum, issue) => sum + issue.issues.length, 0);
  const phenotypesWithIssues = issues?.length || 0;
  const hasIssues = phenotypesWithIssues > 0;

  const renderLabel = () => {
    return (
      <p>
        <span className={styles.labelMain}>
          <span className={styles.issuesText}>Issues</span>
          <br></br>
          <span className={styles.labelSecondary}>
            <span className={`${styles.number} ${styles.totalIssues}`}>{totalIssueCount}</span>
            in
            <span className={`${styles.number} ${styles.phenotypeIssues}`}>
              {phenotypesWithIssues}
            </span>{' '}
            phenotypes
          </span>
        </span>
      </p>
    );
  };

  return (
    <div
      className={`${styles.row} ${selected ? styles.selected : ''} ${hasIssues ? styles.hasIssues : styles.noIssues}`}
    >
      <span className={styles.text}>
        {hasIssues ? renderLabel() : <span className={styles.labelNoIssues}></span>}
      </span>
      <div
        className={`${styles.statusDot} ${hasIssues ? styles.red : styles.green} ${selected ? styles.selected : ''}`}
      />
    </div>
  );
};
