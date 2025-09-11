import React, { useEffect, useState } from 'react';
import { Tabs } from '../../../components/ButtonsAndTabs/Tabs/Tabs';
import styles from './IssuesPopover.module.css';
import { CohortIssue } from './CohortIssuesDisplay';
import { PopoverHeader } from '../../../components/PopoverHeader/PopoverHeader';
import { PhenotypeType } from '../../SlideoverPanels/PhenotypeViewer/phenotype';
import { CohortIssuesDisplay } from './CohortIssuesDisplay';
import { TwoPanelCohortViewerService } from '../TwoPanelCohortViewer/TwoPanelCohortViewer';
import typeStyles from '../../../styles/study_types.module.css';
import BirdIcon from '../../../assets/bird_icon.png'

import { color, group } from 'd3';

interface IssuesPopoverProps {
  issues: CohortIssue[];
  onClose?: () => void; // Add back onClose prop for X button
}

export const IssuesPopover: React.FC<IssuesPopoverProps> = ({ issues, onClose }) => {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const ISSUEPOPOVER_TABS = ['phenex', 'issues'];
  const handleTabChange = (tabIndex: number) => {
    setActiveTabIndex(tabIndex);
  };
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
     <Tabs
        tabs={ISSUEPOPOVER_TABS}
        active_tab_index={activeTabIndex}
        onTabChange={handleTabChange}
        classNameTabsContainer={styles.tabsContainer}
        classNameTabs={styles.tab}
        icons={{ 0: BirdIcon }}
      />
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

  const hidePopover = () => {
    // This function is no longer needed since close logic moved to portal
  };
  
  const renderBird = () => {
    return (
      <img src={BirdIcon} alt="No issues" className={`${styles.birdIcon}`} />
    );
  }

  
  const renderCloseButton = () => {
    return (
      <button
          className={styles.customCloseButton}
          onClick={() => {
            console.log('[IssuesPopover] Custom X button clicked, calling onClose:', onClose);
            if (onClose) {
              onClose();
            }
          }}
        >
          ×
      </button>
    );
  }


  const renderTransparentHeader = () => {
    return (
      <div className={styles.transparentHeader}>
        <div className={styles.transparentHeaderGradient}/>
        {renderCloseButton()}
        {renderTitleLabel()}
      </div>
    );
  }
  // Flatten all issues
  const allIssues = Object.values(groupedIssues).flat();
  // Iterate over each, rendering a phenotype
  return (
    <div className={`${styles.popover} ${issues.length === 0 ? styles.noIssues : ''}`}>
      {renderTransparentHeader()}

      <div className={styles.body}>
        {allIssues.map((issue, index) => renderPhenotype(issue, index))}
      </div>
    </div>
  );
};
