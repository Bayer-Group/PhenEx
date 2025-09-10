import React, { useEffect, useState } from 'react';
import styles from './IssuesPopover.module.css';
import { CohortIssue } from './CohortIssuesDisplay';
import { PopoverHeader } from '../../../components/PopoverHeader/PopoverHeader';
import { PhenotypeType } from '../../SlideoverPanels/PhenotypeViewer/phenotype';
import { CohortIssuesDisplay } from './CohortIssuesDisplay';
import { TwoPanelCohortViewerService } from '../TwoPanelCohortViewer/TwoPanelCohortViewer';
import typeStyles from '../../../styles/study_types.module.css';

import { color, group } from 'd3';

interface IssuesPopoverProps {
  issues: CohortIssue[];
  onClick: (event: MouseEvent) => void;
  draggable?: boolean;
}

export const IssuesPopover: React.FC<IssuesPopoverProps> = ({ issues, onClick, draggable = false }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Subscribe to right panel changes
  useEffect(() => {
    const cohortViewerService = TwoPanelCohortViewerService.getInstance();
    
    const handleRightPanelChange = (viewType: any, extraData: any) => {
      console.log('[IssuesPopover] Right panel changed:', viewType, extraData);
      
      if (viewType === 'phenotype' && extraData && extraData.id) {
        // Find matching phenotype in our issues list using issue.phenotype.id
        const matchingIssue = issues.find(issue => issue.phenotype && issue.phenotype.id === extraData.id);
        
        if (matchingIssue) {
          console.log('[IssuesPopover] Found matching phenotype:', matchingIssue.phenotype.id);
          setSelectedId(matchingIssue.phenotype.id);
        } else {
          // If no matching issue, clear selection
          setSelectedId(null);
        }
      } else {
        // If not a phenotype view or no extraData, clear selection
        setSelectedId(null);
      }
    };

    // Subscribe to service changes
    cohortViewerService.addListener(handleRightPanelChange);
    
    // Initial check for current state
    const currentViewType = cohortViewerService.getCurrentViewType();
    const currentExtraData = cohortViewerService.getExtraData();
    handleRightPanelChange(currentViewType, currentExtraData);

    return () => {
      cohortViewerService.removeListener(handleRightPanelChange);
    };
  }, [issues]); // Re-run when issues change

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

  const colorClass = phenotype => {
    return `rag-${phenotype.type === 'entry' ? 'dark' : phenotype.type === 'inclusion' ? 'blue' : phenotype.type === 'exclusion' ? 'green' : phenotype.type === 'baseline' ? 'coral' : phenotype.type === 'outcome' ? 'red' : ''}-outer`;
  };

  const renderTypeLabel = (issue, index) => {
    return (
      <div className={`${styles.phenotypeType} ${colorClass(issue.phenotype)}`}>
        {issue.phenotype.type}
        {renderIndex(issue.phenotype)}
      </div>
    );
  };
  const totalIssueCount = (issues || []).reduce((sum, issue) => sum + issue.issues.length, 0);
  const phenotypesWithIssues = issues?.length || 0;

  const renderTitleLabel = () => {
    return (
      <div className={styles.titleLabelDiv}>
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
      </div>
    );
  };

  const renderIndex = phenotype => {
    return <span className={styles.index}>{phenotype.type != 'entry' && phenotype.index}</span>;
  };

  const renderPhenotype = (issue, index) => {
    // render a single phenotype
    const phenotypeType = issue.phenotype?.type || '';
    const isSelected = selectedId === issue.phenotype?.id;
    
    // Build class names for hover and selected states using typeStyles
    const typeHoverClass = typeStyles[`${phenotypeType}_list_item`] || '';
    const typeSelectedClass = isSelected ? typeStyles[`${phenotypeType}_list_item_selected`] : '';
    
    return (
      <div
        key={`${issue.phenotype_id}-${index}`}
        className={`${styles.phenotypeSection} ${typeHoverClass} ${typeSelectedClass} ${isSelected ? styles.selected : ''}`}
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
  };

  const hidePopover = (event: MouseEvent) => {
    onClick();
  };
  // Flatten all issues
  const allIssues = Object.values(groupedIssues).flat();
  // Iterate over each, rendering a phenotype
  return (
    <div className={`${styles.popover} ${issues.length === 0 ? styles.noIssues : ''} ${draggable ? styles.draggable : ''}`}>
      <PopoverHeader onClick={onClick} className={`${styles.popoverheader}`} classNameXButton={`${styles.xButton}`}>
        {renderTitleLabel()}
      </PopoverHeader>
      <div className={styles.body}>
        {allIssues.map((issue, index) => renderPhenotype(issue, index))}
      </div>
    </div>
  );
};
