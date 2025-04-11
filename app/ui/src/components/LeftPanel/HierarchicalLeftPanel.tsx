import { FC, useState, useEffect, useRef } from 'react';
import { Tree, NodeRendererProps } from 'react-arborist';
import { LeftPanel } from './LeftPanel';
import styles from './HierarchicalLeftPanel.module.css';
import { Node, TreeNodeData } from './HierarchicalTreeNode';
import { HierarchicalLeftPanelDataService } from './HierarchicalLeftPanelDataService';
import { ViewInfo } from '../MainView/MainView';

const getCollapsedStates = (nodes: TreeNodeData[]): Record<string, boolean> => {
  const states: Record<string, boolean> = {};
  const processNode = (node: TreeNodeData) => {
    states[node.id] = !(node.collapsed ?? false);
    if (node.children) {
      node.children.forEach(processNode);
    }
  };
  nodes.forEach(processNode);
  return states;
};

interface HierarchicalLeftPanelProps {
  isVisible: boolean;
  onNavigate: (viewInfo: ViewInfo) => void;
}

export const HierarchicalLeftPanel: FC<HierarchicalLeftPanelProps> = ({
  isVisible,
  onNavigate,
}) => {
  const [treeHeight, setTreeHeight] = useState(800);
  const [treeData, setTreeData] = useState<TreeNodeData[]>([]);
  const [openState, setOpenState] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const dataService = useRef(HierarchicalLeftPanelDataService.getInstance());

  useEffect(() => {
    const updateTreeData = () => {
      const newTreeData = dataService.current.getTreeData();
      setTreeData(newTreeData);
      setOpenState(getCollapsedStates(newTreeData));
    };

    // Initial setup
    updateTreeData();

    // Subscribe to data service changes
    dataService.current.addListener(updateTreeData);

    return () => dataService.current.removeListener(updateTreeData); // cleanup function removes the listener when component unmounts
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        setTreeHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const renderNode = (props: NodeRendererProps<TreeNodeData>) => (
    <Node {...props} onNavigate={onNavigate} onClickAdd={onClickAdd} />
  );

  const myOnNavigate = (viewInfo: ViewInfo) => {
    onNavigate(viewInfo);
    dataService.current.setSelectedViewInfo(viewInfo);
  };

  const onClickAdd = (name: str) => {
    if (name === 'Cohorts') {
      console.log('CREATING NEW COHORT');
      dataService.current.addNewCohort();
    }
    console.log('CLICKED ADD', name);
  };

  return (
    <LeftPanel isVisible={isVisible}>
      <div className={styles.treeContainer} ref={containerRef}>
        <Tree
          data={treeData}
          width={'calc(100% - 20px)'}
          height={treeHeight}
          indent={15}
          rowHeight={36}
          paddingTop={0}
          paddingBottom={32}
          disableDrag={true}
          initialOpenState={openState}
        >
          {renderNode}
        </Tree>
      </div>
    </LeftPanel>
  );
};
