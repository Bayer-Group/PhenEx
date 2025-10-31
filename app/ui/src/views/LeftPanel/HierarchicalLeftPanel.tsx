import { FC, useState, useEffect, useRef } from 'react';
import { Tree, NodeRendererProps } from 'react-arborist';
import { LeftPanel } from './LeftPanel';
import styles from './HierarchicalLeftPanel.module.css';
import { HierarchicalTreeNode } from './CohortTreeListItem.tsx';
import { HierarchicalLeftPanelDataService } from './HierarchicalLeftPanelDataService';
import { MainViewService } from '../MainView/MainView';

interface HierarchicalLeftPanelProps {
  isVisible: boolean;
}

// Custom Node component for react-arborist
const Node: FC<NodeRendererProps<HierarchicalTreeNode>> = ({ node, style, dragHandle }) => {
  const treeNode = node.data;

  const handleClick = () => {
    // Handle selection in data service
    const dataService = HierarchicalLeftPanelDataService.getInstance();
    dataService.selectNode(treeNode.id);

    // Handle navigation
    if (treeNode.viewInfo) {
      const mainViewService = MainViewService.getInstance();
      mainViewService.navigateTo(treeNode.viewInfo);
    }

    // Toggle expansion
    node.toggle();
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    treeNode.buttonOnClick?.();
  };

  return (
    <div
      ref={dragHandle}
      style={style}
      className={`${styles.node} ${node.isSelected ? styles.selected : ''}`}
      onClick={handleClick}
    >
      <span className={styles.arrow}>
        {node.children?.length ? (node.isOpen ? '▼' : '▶') : ' '}
      </span>
      <span className={styles.nodeName}>{treeNode.displayName}</span>
      {treeNode.hasButton && (
        <button
          className={styles.nodeButton}
          onClick={handleButtonClick}
          title={treeNode.buttonTitle}
        >
          {treeNode.buttonTitle}
        </button>
      )}
    </div>
  );
};

export const HierarchicalLeftPanel: FC<HierarchicalLeftPanelProps> = ({ isVisible }) => {
  const [treeData, setTreeData] = useState<HierarchicalTreeNode[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const dataService = useRef(HierarchicalLeftPanelDataService.getInstance());

  useEffect(() => {
    const updateTreeData = () => {
      const rawTreeData = dataService.current.getTreeData();
      setTreeData(rawTreeData);
    };

    updateTreeData();
    dataService.current.addListener(updateTreeData);

    return () => dataService.current.removeListener(updateTreeData);
  }, []);

  return (
    <LeftPanel isVisible={isVisible} width={280}>
      <div className={styles.treeContainer} ref={containerRef}>
        <Tree
          data={treeData}
          openByDefault={false}
          width="100%"
          height={600}
          indent={12}
        >
          {Node}
        </Tree>
      </div>
    </LeftPanel>
  );
};
