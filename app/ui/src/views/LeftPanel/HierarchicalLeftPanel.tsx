import { FC, useState, useEffect, useRef } from 'react';
import { LeftPanel } from './LeftPanel';
import styles from './HierarchicalLeftPanel.module.css';
import TreeList from '../../components/TreeList/TreeList';
import { HierarchicalTreeListItem, HierarchicalTreeNode } from './HierarchicalTreeListItem';
import { HierarchicalLeftPanelDataService } from './HierarchicalLeftPanelDataService';
import { ViewInfo } from '../MainView/MainView';
import { TreeListItemProps } from '../../components/TreeList/TreeListItem';

interface HierarchicalLeftPanelProps {
  isVisible: boolean;
  onNavigate: (viewInfo: ViewInfo) => void;
}

export const HierarchicalLeftPanel: FC<HierarchicalLeftPanelProps> = ({
  isVisible,
  onNavigate,
}) => {
  const [treeData, setTreeData] = useState<HierarchicalTreeNode[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const dataService = useRef(HierarchicalLeftPanelDataService.getInstance());

  useEffect(() => {
    const updateTreeData = () => {
      const rawTreeData = dataService.current.getTreeData();
      const transformedData = transformTreeData(rawTreeData);
      setTreeData(transformedData);
    };

    // Initial setup
    updateTreeData();

    // Subscribe to data service changes
    dataService.current.addListener(updateTreeData);

    return () => dataService.current.removeListener(updateTreeData);
  }, []);

  const transformTreeData = (nodes: any[], level: number = 0): HierarchicalTreeNode[] => {
    return nodes.map(node => ({
      id: node.id,
      displayName: node.name,
      level,
      viewInfo: node.viewInfo,
      children: node.children ? transformTreeData(node.children, level + 1) : [],
      treeListItem: HierarchicalTreeListItem
    }));
  };

  const onClickAdd = async (name: string) => {
    if (name === 'Cohorts') {
      const newCohortViewInfo = await dataService.current.addNewCohort();
      if (newCohortViewInfo) {
        onNavigate(newCohortViewInfo);
      }
    }
  };

  return (
    <LeftPanel isVisible={isVisible} width={280}>
      <div className={styles.treeContainer} style={{ width: '100%', height: '100%' }} ref={containerRef}>
        <TreeList
          data={treeData.map(node => ({
            ...node,
            treeListItem: (props: TreeListItemProps) => (
              <HierarchicalTreeListItem
                {...props}
                node={props.node as HierarchicalTreeNode}
                onNavigate={onNavigate}
                onClickAdd={onClickAdd}
              />
            )
          }))}
        />
      </div>
    </LeftPanel>
  );
};
