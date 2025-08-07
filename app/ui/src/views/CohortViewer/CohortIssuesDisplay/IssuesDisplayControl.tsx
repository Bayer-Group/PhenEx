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
      // issuesService.validateCohort();
      setIssues(issuesService.issues);
    };
    issuesService.addListener(listener);

    return () => {
      issuesService.removeListener(listener);
    };
  }, [dataService]);

  const handleClick = () => {
    setShowPopover(!showPopover);
  };

  return (
    <div
      className={`${styles.container} ${showPopover ? styles.showingPopover : ''} ${issues?.length? styles.hasIssues : styles.noIssues}`}
      onClick={handleClick}
    >
      <div className={styles.popover}>{showPopover && <IssuesPopover issues={issues} />}</div>
      <div className={styles.issuesButton}>
        <CohortIssuesDisplay issues={issues} selected={showPopover} />
      </div>
    </div>
  );
};
