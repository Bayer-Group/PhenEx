import React, { useEffect, useState } from 'react';
import { IssuesPopover } from './IssuesPopover';
import { CohortIssuesDisplay } from './CohortIssuesDisplay';
import styles from './IssuesDisplayControl.module.css';
import { CohortDataService } from '../CohortDataService/CohortDataService';

export interface CohortIssue {
  phenotype_id: string;
  issues: string[];
}

export const IssuesDisplayControl: React.FC = () => {
  const [showPopover, setShowPopover] = useState(false);
  const [issues, setIssues] = useState<CohortIssue[]>([]);
  const [dataService] = useState(() => CohortDataService.getInstance());
  const issuesService = dataService.issues_service;

  useEffect(() => {
    const listener = () => {
      issuesService.validateCohort();
      setIssues(issuesService.issues);
    };
    dataService.addListener(listener);

    return () => {
      dataService.removeListener(listener);
    };
  }, [dataService]);

  const handleClick = () => {
    setShowPopover(!showPopover);
  };

  return (
    <div
      className={styles.container}
      onClick={handleClick}
    >
      <div className={styles.issuesButton}>
      <CohortIssuesDisplay issues={issues} selected={showPopover} />
      </div>
      {showPopover && <IssuesPopover issues={issues} />}
    </div>
  );
};
