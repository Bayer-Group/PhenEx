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
      <>
        <span className={styles.labelMain}>
          {/* <span className={styles.number}>{totalIssueCount}</span>  */}
          Issues</span><br></br>
        <span className={styles.labelSecondary}><span className={styles.number}>
          <span className={`${styles.number} ${styles.totalIssues}`}>{totalIssueCount}</span>
          in {phenotypesWithIssues}</span> phenotypes</span>
      </>

    )
  }

  return (
    <div className={`${styles.row} ${selected ? styles.selected : ''} ${hasIssues ? styles.hasIssues : styles.noIssues}`}>
      <div
        className={`${styles.statusDot} ${hasIssues ? styles.red : styles.green} ${selected ? styles.selected : ''}`}
      />
      <span className={styles.text}>
        {hasIssues
          ? renderLabel()
          : <span className={styles.labelNoIssues}>0 issues</span>}
      </span>
    </div>
  );
};
