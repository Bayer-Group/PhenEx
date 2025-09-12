import React, { useEffect, useState } from 'react';
import styles from './CohortIssuesDisplay.module.css';
import { XButton } from '../../../components/ButtonsAndTabs/XButton/XButton';
import BirdIcon from '../../../assets/bird_icon.png'

export interface CohortIssue {
  phenotype_id: string;
  issues: string[];
}

interface CohortIssuesDisplayProps {
  issues: CohortIssue[];
  selected?: boolean;
  onClick;
}

export const CohortIssuesDisplay: React.FC<CohortIssuesDisplayProps> = ({
  issues,
  selected = false,
  onClick,
}) => {
  const totalIssueCount = (issues || []).reduce((sum, issue) => sum + issue.issues.length, 0);
  const phenotypesWithIssues = issues?.length || 0;
  const hasIssues = phenotypesWithIssues > 0;


  const renderXButton = () => {
    return <XButton onClick={undefined} className={styles.xButton} />;
  };

  const renderText = () => {
    return (
       <div className={styles.labelUnselected}>
          Issues
        </div>
    );
  };

  const renderBird = () => {
    return (
      <img src={BirdIcon} alt="No issues" className={`${styles.birdIcon} ${hasIssues ? styles.birdIssues : styles.birdNoIssues}`} />
    );
  }

  return (
    <div
      className={`${styles.row} ${selected ? styles.selected : ''} ${hasIssues ? styles.hasIssues : styles.noIssues}`}
      onClick={selected ? onClick : undefined}
    >
      <span className={styles.text}>
        {hasIssues ? renderText() : ''}
      </span>
      <div
        className={`${styles.statusDot} ${hasIssues ? styles.red : styles.green} ${selected ? styles.selected : ''}`}
      >
        {totalIssueCount}
      </div>
      {renderBird()}
      {selected && renderXButton()}
    </div>
  );
};
