import { FC, useState, useEffect, useRef } from 'react';
import { LeftPanel } from './LeftPanel';
import styles from './HierarchicalLeftPanel.module.css';
import TreeList from '../../components/TreeList/TreeList';
import { CohortTreeListItem, HierarchicalTreeNode } from './CohortTreeListItem.tsx';
import { HierarchicalLeftPanelDataService } from './HierarchicalLeftPanelDataService';

interface HierarchicalLeftPanelProps {
  isVisible: boolean;
}

export const HierarchicalLeftPanel: FC<HierarchicalLeftPanelProps> = ({ isVisible }) => {
  const [treeData, setTreeData] = useState<HierarchicalTreeNode[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const dataService = useRef(HierarchicalLeftPanelDataService.getInstance());

  useEffect(() => {
    const updateTreeData = () => {
      const rawTreeData = dataService.current.getTreeData();
      setTreeData(rawTreeData);
    };

    // Initial setup
    updateTreeData();

    // Subscribe to data service changes
    dataService.current.addListener(updateTreeData);

    return () => dataService.current.removeListener(updateTreeData);
  }, []);

  const clickedOnItem = () => {};

  return (
    <LeftPanel isVisible={isVisible} width={280}>
      <div
        className={styles.treeContainer}
        style={{ width: '100%', height: '100%' }}
        ref={containerRef}
      >
        <TreeList data={treeData} />
      </div>
    </LeftPanel>
  );
};
