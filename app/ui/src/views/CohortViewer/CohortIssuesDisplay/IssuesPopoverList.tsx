import React, { useEffect, useState } from 'react';
import styles from './IssuesPopoverList.module.css';
import { CohortIssue } from './CohortIssuesDisplay';
import { PhenotypeType } from '../../SlideoverPanels/PhenotypeViewer/phenotype';
import { TwoPanelCohortViewerService } from '../TwoPanelCohortViewer/TwoPanelCohortViewer';
import typeStyles from '../../../styles/study_types.module.css';
import buttonStyles from '../../SlideoverPanels/StudyIssuesPanel/FixWithAIButton.module.css';
import { chatPanelDataService } from '../../ChatPanel/ChatPanelDataService';

interface IssuesPopoverListProps {
  issues: CohortIssue[];
  onSwitchToAIChat?: () => void;
}


const IssuesPopoverList: React.FC<IssuesPopoverListProps> = ({ issues, onSwitchToAIChat }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleFixWithAI = (issue: CohortIssue, event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Format the issue message for AI
    const issueText = `Please fix the following issue in the "${issue.phenotype_name}" ${issue.type} phenotype:\n\n${issue.issues.map(i => `- ${i}`).join('\n')}`;
    
    // Start a new chat session by clearing previous messages
    chatPanelDataService.clearMessages();
    
    // Add the message to AI chat (this automatically sends it)
    chatPanelDataService.addUserMessageWithText(issueText);
    
    // Switch to AI Chat tab if callback is provided
    if (onSwitchToAIChat) {
      onSwitchToAIChat();
    }
  };

  useEffect(() => {
    const cohortViewerService = TwoPanelCohortViewerService.getInstance();
    const handleRightPanelChange = (viewType: any, extraData: any) => {
      // Debug log to trace selection sync
      console.log('[IssuesPopoverList] Right panel change:', viewType, extraData);
      if (viewType === 'phenotype' && extraData && extraData.id) {
        console.log("ENTERING")
        const matchingIssue = issues.find(issue => issue.phenotype_id === extraData.id);
        if (matchingIssue) {
            console.log("matchingISSUE", matchingIssue);
          setSelectedId(matchingIssue.phenotype_id);
        } else {
            console.log("SETTING NULL")
          setSelectedId(null);
        }
      } else {
        console.log("FINLAL NULL")
        setSelectedId(null);
      }
    };
    cohortViewerService.addListener(handleRightPanelChange);
    // Always sync selection to current right panel state on mount and issues change
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
    return typeStyles[`${type}_color_block`] || '';
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
    // Add debug log to see which item is selected
    // console.log('[IssuesPopoverList] Render', issue.phenotype_id, 'isSelected:', isSelected);
    return (
      <div
        key={`${issue.phenotype_id}-${index}`}
        className={`${styles.phenotypeSection} ${typeHoverClass} ${typeSelectedClass}`}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <p className={styles.issuesList} style={{ flex: 1, margin: 0 }}>missing {issue.issues.join(', ')}</p>
          <button
            className={buttonStyles.fixWithAIButton}
            onClick={(e) => handleFixWithAI(issue, e)}
            title="Fix with AI"
          >
            Fix with AI
          </button>
        </div>
      </div>
    );
  };

  const allIssues = Object.values(groupedIssues).flat();

  return (
    <>
      <div className={styles.topPadding}/>
      {allIssues.length === 0 ? (
        <div className={styles.noIssuesMessage}>
          <p>✅ No issues found!</p>
          <p className={styles.noIssuesSubtext}>Your cohort configuration looks good.</p>
        </div>
      ) : (
        allIssues.map((issue, index) => renderPhenotype(issue, index))
      )}
    </>
  );
};

export default IssuesPopoverList;
