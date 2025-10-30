import React from 'react';
import { AccordionItemRendererProps, AccordionNode } from './AccordionListItem';
import { ViewInfo, MainViewService } from '../../views/MainView/MainView';
import { HierarchicalLeftPanelDataService } from '../../views/LeftPanel/HierarchicalLeftPanelDataService';
import styles from './AccordionList.module.css';

export interface CohortAccordionNode extends AccordionNode {
  id: string;
  viewInfo?: ViewInfo;
}

export const CohortAccordionListItem: React.FC<AccordionItemRendererProps> = ({ 
  node, 
  onSelect
}) => {
  const cohortNode = node as CohortAccordionNode;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('🔄 CohortAccordionListItem: Click on cohort:', cohortNode.displayName);

    // Handle selection
    const dataService = HierarchicalLeftPanelDataService.getInstance();
    dataService.selectNode(cohortNode.id);
    onSelect(cohortNode.id);

    // Handle navigation if there's a viewInfo
    if (cohortNode.viewInfo) {
      const mainViewService = MainViewService.getInstance();
      mainViewService.navigateTo(cohortNode.viewInfo);
    }
  };

  return (
    <div 
      className={`${styles.childItem} ${node.selected ? styles.selected : ''}`}
      onClick={handleClick}
    >
      <span>{node.displayName}</span>
    </div>
  );
};