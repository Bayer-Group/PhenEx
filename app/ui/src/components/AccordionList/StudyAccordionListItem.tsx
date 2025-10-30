import React from 'react';
import { AccordionItemRendererProps, AccordionNode } from './AccordionListItem';
import { ViewInfo, MainViewService } from '../../views/MainView/MainView';
import { HierarchicalLeftPanelDataService } from '../../views/LeftPanel/HierarchicalLeftPanelDataService';
import { CohortAccordionListItem } from './CohortAccordionListItem';
import styles from './AccordionList.module.css';

export interface StudyAccordionNode extends AccordionNode {
  id: string;
  viewInfo?: ViewInfo;
}

export const StudyAccordionListItem: React.FC<AccordionItemRendererProps> = ({ 
  node, 
  isExpanded,
  onToggle, 
  onSelect,
  additionalProps
}) => {
  const studyNode = node as StudyAccordionNode;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🔄 StudyAccordionListItem: Click on study:', studyNode.displayName, 'has children:', node.children.length > 0);

    // Handle selection
    const dataService = HierarchicalLeftPanelDataService.getInstance();
    dataService.selectNode(studyNode.id);
    onSelect(studyNode.id);

    // Handle toggle
    if (node.children.length > 0) {
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

  return (
    <div className={styles.accordionItem}>
      <div 
        className={`${styles.accordionHeader} ${node.selected ? styles.selected : ''}`}
        onClick={handleClick}
      >
        <div className={styles.headerContent}>
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
          <div className={styles.headerText}>{node.displayName}</div>
        </div>
        
        <div className={styles.headerActions}>
          {node.hasButton && (
            <button
              className={styles.actionButton}
              onClick={handleButtonClick}
              title={node.buttonTitle || 'Add Cohort'}
            >
              {node.buttonTitle || 'Add Cohort'}
            </button>
          )}
        </div>
      </div>

      {hasChildren && (
        <div className={`${styles.accordionContent} ${isExpanded ? styles.expanded : styles.collapsed}`}>
          <div className={styles.childrenContainer}>
            {node.children.map((child, index) => (
              <CohortAccordionListItem
                key={`${child.displayName}-${index}`}
                node={child as AccordionNode}
                isExpanded={false}
                onToggle={() => {}}
                onSelect={onSelect}
                additionalProps={additionalProps}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};