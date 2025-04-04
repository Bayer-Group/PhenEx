import React, { useEffect, useState } from 'react';
import styles from './IssuesPopover.module.css';
import { CohortIssue } from './CohortIssuesDisplay';
import { PhenotypeType } from '../../../types/phenotype';
import { CohortIssuesDisplay } from './CohortIssuesDisplay';
import { TwoPanelCohortViewerService } from '../TwoPanelCohortViewer/TwoPanelCohortViewer';

import { group } from 'd3';

interface IssuesPopoverProps {
  issues: CohortIssue[];
}

export const IssuesPopover: React.FC<IssuesPopoverProps> = ({ issues }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  console.log("issues", issues)
  const groupedIssues = issues.reduce(
    (acc, issue) => {
      const type = issue.type as PhenotypeType;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(issue);
      return acc;
    },
    {} as { [key in PhenotypeType]: CohortIssue[] }
  );
  return (
    <div className={styles.popover}>
      {/* <div className = {styles.header}>
        <CohortIssuesDisplay issues={issues}/>
      </div> */}
      <div className = {styles.body}>
        {Object.entries(groupedIssues).map(([type, typeIssues]) => (
          <div key={type} className={styles.section}>
            {typeIssues.map((issue, index) => (
              <div 
                key={`${issue.phenotype_id}-${index}`} 
                className={`${styles.phenotypeSection} ${selectedId === issue.phenotype.id ? styles.selected : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  console.log("CLIDKED ON ",issue.phenotype.id)
                  setSelectedId(issue.phenotype.id);
                  const cohortViewer = TwoPanelCohortViewerService.getInstance();
                  cohortViewer.displayExtraContent('phenotype', issue.phenotype);
                }}
              >
                <div className={styles.phenotypeId}>{issue.phenotype_name}</div>
                <p className={styles.issuesList}>
                  missing {issue.issues.join(', ')}
                </p>
                <div className = {`${styles.phenotypeType} rag-${issue.phenotype.type === 'entry' ? 'dark' : issue.phenotype.type === 'inclusion' ? 'blue' : issue.phenotype.type === 'exclusion' ? 'green' : issue.phenotype.type === 'baseline' ? 'coral' : issue.phenotype.type === 'outcome' ? 'red' : ''}-outer`}>{issue.phenotype.type}</div>

              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
