import React from 'react';
import { TreeNode, TreeItemRendererProps } from '../../components/TreeList/TreeListItem';
import { ViewInfo, MainViewService } from '../MainView/MainView';
import { HierarchicalLeftPanelDataService } from './HierarchicalLeftPanelDataService';
import styles from './CohortTreeListItem.module.css';

export interface HierarchicalTreeNode extends TreeNode {
  id: string;
  viewInfo?: ViewInfo;
}

export const CohortTreeRenderer: React.FC<TreeItemRendererProps> = ({ 
  node,
  additionalProps
}) => {
  const { onClickAdd } = additionalProps || {};
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const hierarchicalNode = node as HierarchicalTreeNode;
    
    // First handle selection
    const dataService = HierarchicalLeftPanelDataService.getInstance();
    dataService.selectNode(hierarchicalNode.id);
    
    // Then handle navigation if there's a viewInfo
    if (hierarchicalNode.viewInfo) {
      const mainViewService = MainViewService.getInstance();
      mainViewService.navigateTo(hierarchicalNode.viewInfo);
    }
  };

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClickAdd) {
      onClickAdd(node.displayName);
    }
  };

  return (
    <div className={styles.content} onClick={handleClick}>
      <span className={`${styles.nodeName} ${node.selected ? styles.selected : ''}`}>
        {node.displayName}
      </span>
    </div>
  );
};
