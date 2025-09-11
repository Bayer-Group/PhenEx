import React, { useEffect, useState } from 'react';
import styles from './IssuesPopoverList.module.css';
import { CohortIssue } from './CohortIssuesDisplay';
import { PhenotypeType } from '../../SlideoverPanels/PhenotypeViewer/phenotype';
import { TwoPanelCohortViewerService } from '../TwoPanelCohortViewer/TwoPanelCohortViewer';
import typeStyles from '../../../styles/study_types.module.css';

interface IssuesPopoverListProps {
  issues: CohortIssue[];
}


const IssuesPopoverList: React.FC<IssuesPopoverListProps> = ({ issues }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const cohortViewerService = TwoPanelCohortViewerService.getInstance();
    const handleRightPanelChange = (viewType: any, extraData: any) => {
      if (viewType === 'phenotype' && extraData && extraData.id) {
        const matchingIssue = issues.find(issue => issue.phenotype_id === extraData.id);
        if (matchingIssue) {
          setSelectedId(matchingIssue.phenotype_id);
        } else {
          setSelectedId(null);
        }
      } else {
        setSelectedId(null);
      }
    };
    cohortViewerService.addListener(handleRightPanelChange);
    const currentViewType = cohortViewerService.getCurrentViewType();
    const currentExtraData = cohortViewerService.getExtraData();
    handleRightPanelChange(currentViewType, currentExtraData);
    return () => {
      cohortViewerService.removeListener(handleRightPanelChange);
    };
  }, [issues]);

  // Group issues by type
  const groupedIssues = issues.reduce(
    (acc: { [key in PhenotypeType]?: CohortIssue[] }, issue: CohortIssue) => {
      const type = issue.type as PhenotypeType;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type]!.push(issue);
      return acc;
    },
    {} as { [key in PhenotypeType]?: CohortIssue[] }
  );

  // Helper to get color class from type
  const colorClass = (type: PhenotypeType) => {
    return `rag-${type === 'entry' ? 'dark' : type === 'inclusion' ? 'blue' : type === 'exclusion' ? 'green' : type === 'baseline' ? 'coral' : type === 'outcome' ? 'red' : ''}-outer`;
  };

  // Render type label
  const renderTypeLabel = (issue: CohortIssue) => {
    return (
      <div className={`${styles.phenotypeType} ${colorClass(issue.type as PhenotypeType)}`}>
        {issue.type}
        {renderIndex(issue.phenotype)}
      </div>
    );
  };

  // Render index if present
  const renderIndex = (phenotype: any) => {
    return <span className={styles.index}>{phenotype && phenotype.type !== 'entry' && phenotype.index}</span>;
  };

  // Render phenotype row
  const renderPhenotype = (issue: CohortIssue, index: number) => {
    const phenotypeType = issue.type as PhenotypeType;
    const isSelected = selectedId === issue.phenotype_id;
    const typeHoverClass = typeStyles[`${phenotypeType}_list_item`] || '';
    const typeSelectedClass = isSelected ? typeStyles[`${phenotypeType}_list_item_selected`] : '';
    return (
      <div
        key={`${issue.phenotype_id}-${index}`}
        className={`${styles.phenotypeSection} ${typeHoverClass} ${typeSelectedClass} ${isSelected ? styles.selected : ''}`}
        onClick={event => {
          event.stopPropagation();
          setSelectedId(issue.phenotype_id);
          const cohortViewer = TwoPanelCohortViewerService.getInstance();
          cohortViewer.displayExtraContent('phenotype', issue.phenotype);
        }}
      >
        <div className={styles.phenotypeId}>
          {renderTypeLabel(issue)}
          {issue.phenotype_name}
        </div>
        <p className={styles.issuesList}>missing {issue.issues.join(', ')}</p>
      </div>
    );
  };

  const allIssues = Object.values(groupedIssues).flat();

  return (
    <>
      {allIssues.map((issue, index) => renderPhenotype(issue, index))}
    </>
  );
};

export default IssuesPopoverList;
