import React, { useEffect, useState } from 'react';
import { CohortIssuesService } from './CohortIssuesService';
import { CohortDataService } from '../CohortDataService';
import { IssuesPopover } from './IssuesPopover';
import styles from './CohortIssuesDisplay.module.css';

export interface CohortIssue {
  phenotype_id: string;
  issues: string[];
}

export const CohortIssuesDisplay: React.FC = () => {
  const [issues, setIssues] = useState<CohortIssue[]>([]);
  const [showPopover, setShowPopover] = useState(false);
  const [dataService] = useState(() => CohortDataService.getInstance());
  const issuesService = CohortIssuesService.getInstance();

  useEffect(() => {
    // Add listener for data service updates
    const listener = () => {
      issuesService.validateCohort();
      setIssues(issuesService.issues);
      console.log(issues);
    };
    dataService.addListener(listener);

    return () => {
      dataService.removeListener(listener);
    };
  }, [dataService]);

  const totalIssueCount = (issues || []).reduce((sum, issue) => sum + issue.issues.length, 0);
  const phenotypesWithIssues = issues?.length || 0;
  const hasIssues = phenotypesWithIssues > 0;

  return (
    <div
      className={styles.container}
      onMouseEnter={() => hasIssues && setShowPopover(true)}
      onMouseLeave={() => setShowPopover(false)}
    >
      <div className={styles.row}>
        <div className={`${styles.statusDot} ${hasIssues ? styles.red : styles.green}`} />
        <span className={styles.text}>
          {hasIssues
            ? `${totalIssueCount} issues in ${phenotypesWithIssues} phenotypes`
            : 'No issues found'}
        </span>
      </div>
      {showPopover && hasIssues && <IssuesPopover issues={issues} />}
    </div>
  );
};
