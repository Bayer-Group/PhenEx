import React from 'react';
import { TreeNode, TreeItemRendererProps } from '../../components/TreeList/TreeListItem';
import { ViewInfo, MainViewService } from '../MainView/MainView';
import { HierarchicalLeftPanelDataService } from './HierarchicalLeftPanelDataService';
import styles from './StudyTreeListItem.module.css';

export interface StudyTreeNode extends TreeNode {
  id: string;
  viewInfo?: ViewInfo;
}

export const StudyTreeRenderer: React.FC<TreeItemRendererProps> = ({ 
  node, 
  onToggle, 
  caretElement,
  defaultArrowClassName 
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const studyNode = node as StudyTreeNode;
    
    console.log('🔄 StudyTreeRenderer: Click on study:', studyNode.displayName, 'has children:', node.children.length > 0);

    // Handle selection
    const dataService = HierarchicalLeftPanelDataService.getInstance();
    dataService.selectNode(studyNode.id);

    // Handle toggle - let TreeListItem manage its own state
    if (node.children.length > 0) {
      console.log('🔄 StudyTreeRenderer: Using TreeListItem onToggle for expansion');
      onToggle();
    }

    // Then handle navigation if there's a viewInfo
    if (studyNode.viewInfo) {
      if (node.children.length > 1) {
        const mainViewService = MainViewService.getInstance();
        mainViewService.navigateTo(studyNode.viewInfo);
      } else {
        const mainViewService = MainViewService.getInstance();
        mainViewService.navigateTo(studyNode.viewInfo);

      }
    }
  };

  // Clone the caret element and modify the nested button's className
  const customCaretElement = caretElement && React.cloneElement(caretElement as React.ReactElement<any>, {
    children: React.cloneElement((caretElement as any).props.children, {
      className: `${(caretElement as any).props.children.props.className} ${styles.studyArrow}`
    })
  });

  return (
    <div className={styles.studyContainer || ''}>
      {customCaretElement}
      <div className={styles.content} onClick={handleClick}>
        <span className={`${styles.nodeName} ${styles.studyLabel || ''} ${node.selected ? styles.selected : ''}`}>
          {node.displayName}
        </span>
      </div>
    </div>
  );
};