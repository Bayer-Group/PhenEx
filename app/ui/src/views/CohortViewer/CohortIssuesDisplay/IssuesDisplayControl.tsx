import React, { useEffect, useState, useRef } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const listener = () => {
      setIssues(issuesService.issues);
    };
    issuesService.addListener(listener);

    return () => {
      issuesService.removeListener(listener);
    };
  }, [dataService]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
      //   setShowPopover(false);
      // }
    };

    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPopover]);

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!showPopover) {
      setShowPopover(!showPopover);
    }
  };
  const closePopover = () => {
    setShowPopover(false);
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${showPopover ? styles.showingPopover : ''} ${
        issues?.length ? styles.hasIssues : styles.noIssues
      }`}
      onClick={handleClick}
    >
      <div className={styles.popover}>{showPopover && <IssuesPopover issues={issues} onClick={closePopover}/>}</div>
      <div className={styles.issuesButton}>
        <CohortIssuesDisplay issues={issues} selected={showPopover} onClick={closePopover} />
      </div>
    </div>
  );
};
