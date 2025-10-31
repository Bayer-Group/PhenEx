import React from 'react';
import { AccordionItemRendererProps, AccordionNode } from './AccordionListItem';
import { ViewInfo, MainViewService } from '../../views/MainView/MainView';
import { HierarchicalLeftPanelDataService } from '../../views/LeftPanel/HierarchicalLeftPanelDataService';
import { CohortAccordionListItem } from './CohortAccordionListItem';
import styles from './AccordionList.module.css';
import studyItemStyles from './StudyAccordianListItem.module.css';

export interface StudyAccordionNode extends AccordionNode {
  id: string;
  viewInfo?: ViewInfo;
}

export const StudyAccordionListItem: React.FC<AccordionItemRendererProps> = ({ 
  node, 
  isExpanded,
  onToggle,
  additionalProps
}) => {
  const studyNode = node as StudyAccordionNode;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🔄 StudyAccordionListItem: Click on study:', studyNode.displayName, 'has children:', node.children.length > 0);

    // Handle selection through the data service
    const dataService = HierarchicalLeftPanelDataService.getInstance();
    dataService.selectNode(studyNode.id);

    // Handle toggle
    if (node.children.length > 0 && !isExpanded) {
      console.log('🔄 StudyAccordionListItem: Toggling expansion');
      onToggle();
    }

    // Handle navigation if there's a viewInfo
    if (studyNode.viewInfo) {
      const mainViewService = MainViewService.getInstance();
      mainViewService.navigateTo(studyNode.viewInfo);
    }
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.buttonOnClick) {
      node.buttonOnClick();
    }
  };

  const hasChildren = node.children.length > 0;

  const renderHeader = () =>{
    return (
      <div 
        className={`${styles.accordionHeader} ${node.selected ? styles.selected : ''} ${isExpanded ? styles.expanded : ''} ${styles.level1}`}
        onClick={handleClick}
      >
        <div className={styles.headerContent}>
          
          <div className={styles.headerText}>{node.displayName}</div>
            {hasChildren && (
            <div 
              className={`${styles.expandIcon} ${isExpanded ? styles.expanded : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
            >
              ›
            </div>
          )}
        </div>
      </div>
    );
  }

  const renderCohorts = () =>{
    return (
      <div className={`${styles.accordionContent} ${isExpanded ? styles.expanded : styles.collapsed}`}>
          <div className={`${styles.childrenContainer} ${styles.toDisplay}`}>
            {node.children.map((child, index) => (
              <CohortAccordionListItem
                key={`${child.displayName}-${index}`}
                node={child as AccordionNode}
                isExpanded={false}
                onToggle={() => {}}
                onSelect={() => {}}
                additionalProps={additionalProps}
              />
            ))}
            {renderAddCohortButton()}
          </div>
        </div>
    );
  }

    const renderAddCohortButton = () =>{
    return (
        <div className={studyItemStyles.bottomActionContainer}>
          {node.hasButton && (
            <button
              className={studyItemStyles.addCohortButton}
              onClick={handleButtonClick}
              title={'+ New cohort'}
            >
              {'+ New cohort'}
            </button>
          )}
        </div>
    );
  }

  return (
    <div className={`${styles.accordionItemToDisplay} ${isExpanded ? styles.expanded : ''}`}>
      {renderHeader()}

      {hasChildren && (
        renderCohorts()
      )}
    </div>
  );
};