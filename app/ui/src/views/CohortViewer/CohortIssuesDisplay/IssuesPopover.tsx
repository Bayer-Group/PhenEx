import React, { useEffect, useState } from 'react';
import styles from './IssuesPopover.module.css';
import { CohortIssue } from './CohortIssuesDisplay';
import { PhenotypeType } from '../../PhenotypeViewer/phenotype';
import { CohortIssuesDisplay } from './CohortIssuesDisplay';
import { TwoPanelCohortViewerService } from '../TwoPanelCohortViewer/TwoPanelCohortViewer';

import { group } from 'd3';

interface IssuesPopoverProps {
  issues: CohortIssue[];
}

export const IssuesPopover: React.FC<IssuesPopoverProps> = ({ issues }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const renderTypeLabel = (issue, index) =>{
    return (
      <div
          className={`${styles.phenotypeType} rag-${issue.phenotype.type === 'entry' ? 'dark' : issue.phenotype.type === 'inclusion' ? 'blue' : issue.phenotype.type === 'exclusion' ? 'green' : issue.phenotype.type === 'baseline' ? 'coral' : issue.phenotype.type === 'outcome' ? 'red' : ''}-outer`}
        >
          {issue.phenotype.type}
          {renderIndex(issue.phenotype)}
        </div>
    )
  }

  const renderIndex = (phenotype) => {
    return (
      <span className = {styles.index}>
        {phenotype.type != 'entry' && phenotype.index}
      </span>
    );
  }

  const renderPhenotype = (issue, index) => {
    // render a single phenotype
    return (
      <div
        key={`${issue.phenotype_id}-${index}`}
        className={`${styles.phenotypeSection} ${selectedId === issue.phenotype.id ? styles.selected : ''}`}
        onClick={event => {
          event.stopPropagation();
          setSelectedId(issue.phenotype.id);
          const cohortViewer = TwoPanelCohortViewerService.getInstance();
          cohortViewer.displayExtraContent('phenotype', issue.phenotype);
        }}
      >

        <div className={styles.phenotypeId}>
            {renderTypeLabel(issue, index)}
            {issue.phenotype_name}
        </div>
        <p className={styles.issuesList}>missing {issue.issues.join(', ')}</p>
      </div>
    );
  }

  // Flatten all issues
  const allIssues = Object.values(groupedIssues).flat();
  // Iterate over each, rendering a phenotype
  return (
    <div className={`${styles.popover} ${issues.length === 0 ? styles.noIssues : ''}`}>
      <div className={styles.body}>
        {allIssues.map((issue, index) => (
          renderPhenotype(issue, index)
        ))}
      </div>
    </div>
  );
};
