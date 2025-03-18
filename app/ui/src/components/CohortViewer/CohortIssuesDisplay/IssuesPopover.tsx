import React from 'react';
import styles from './IssuesPopover.module.css';
import { CohortIssue } from './CohortIssuesDisplay';
import { PhenotypeType } from '../../../types/phenotype';

interface IssuesPopoverProps {
  issues: CohortIssue[];
}

export const IssuesPopover: React.FC<IssuesPopoverProps> = ({ issues }) => {
  const groupedIssues = issues.reduce((acc, issue) => {
    const type = issue.type as PhenotypeType;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(issue);
    return acc;
  }, {} as { [key in PhenotypeType]: CohortIssue[] });

  return (
    <div className={styles.popover}>
      {Object.entries(groupedIssues).map(([type, typeIssues]) => (
        <div key={type} className={styles.section}>
          <h3 className={styles.sectionTitle}>{type.charAt(0).toUpperCase() + type.slice(1)}</h3>
          {typeIssues.map((issue, index) => (
            <div key={`${issue.phenotype_id}-${index}`} className={styles.phenotypeSection}>
              <div className={styles.phenotypeId}>{issue.phenotype_name}</div>
              <ul className={styles.issuesList}>
                {issue.issues.map((issueText, i) => (
                  <li key={i} className={styles.issueItem}>{issueText}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};