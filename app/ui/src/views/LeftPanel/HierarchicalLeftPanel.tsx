import { FC, useState, useEffect, useRef, useMemo } from 'react';
import { ControlledTreeEnvironment, Tree, TreeItemIndex, TreeItem, StaticTreeDataProvider } from 'react-complex-tree';
import 'react-complex-tree/lib/style-modern.css';
import { LeftPanel } from './LeftPanel';
import styles from './HierarchicalLeftPanel.module.css';
import { HierarchicalTreeNode } from './CohortTreeListItem.tsx';
import { HierarchicalLeftPanelDataService } from './HierarchicalLeftPanelDataService';
import { MainViewService } from '../MainView/MainView';

interface HierarchicalLeftPanelProps {
  isVisible: boolean;
}

// Convert HierarchicalTreeNode to react-complex-tree format
const convertToComplexTree = (nodes: HierarchicalTreeNode[]): Record<TreeItemIndex, TreeItem<HierarchicalTreeNode>> => {
  console.log('🔧 convertToComplexTree: Input nodes:', nodes);
  
  const items: Record<TreeItemIndex, TreeItem<HierarchicalTreeNode>> = {
    root: {
      index: 'root',
      isFolder: true,
      children: nodes.map(n => n.id),
      data: undefined as any,
    },
  };

  console.log('🔧 convertToComplexTree: Root children IDs:', nodes.map(n => n.id));

  const processNode = (node: HierarchicalTreeNode) => {
    const hasChildren = node.children && node.children.length > 0;
    items[node.id] = {
      index: node.id,
      isFolder: hasChildren,
      children: hasChildren ? (node.children as HierarchicalTreeNode[]).map(c => c.id) : undefined,
      data: node,
    };
    
    console.log(`🔧 processNode: ${node.displayName} (${node.id}), isFolder: ${hasChildren}, children:`, hasChildren ? (node.children as HierarchicalTreeNode[]).map(c => c.id) : 'none');

    if (hasChildren) {
      (node.children as HierarchicalTreeNode[]).forEach(processNode);
    }
  };

  nodes.forEach(processNode);
  
  console.log('🔧 convertToComplexTree: Final items:', items);
  return items;
};

export const HierarchicalLeftPanel: FC<HierarchicalLeftPanelProps> = ({ isVisible }) => {
  const [treeData, setTreeData] = useState<HierarchicalTreeNode[]>([]);
  const [expandedItems, setExpandedItems] = useState<TreeItemIndex[]>(['root', 'mystudies', 'publicstudies']);
  const [selectedItems, setSelectedItems] = useState<TreeItemIndex[]>([]);
  const [focusedItem, setFocusedItem] = useState<TreeItemIndex>();
  const dataService = useRef(HierarchicalLeftPanelDataService.getInstance());

  useEffect(() => {
    const updateTreeData = () => {
      const rawTreeData = dataService.current.getTreeData();
      console.log('🌲 HierarchicalLeftPanel: Received tree data:', rawTreeData);
      setTreeData(rawTreeData);
    };

    updateTreeData();
    dataService.current.addListener(updateTreeData);

    return () => dataService.current.removeListener(updateTreeData);
  }, []);

  const items = useMemo(() => {
    const converted = convertToComplexTree(treeData);
    console.log('🌲 HierarchicalLeftPanel: Converted items:', converted);
    return converted;
  }, [treeData]);

  const dataProvider = useMemo(
    () => {
      try {
        return new StaticTreeDataProvider<HierarchicalTreeNode>(
          items, 
          (item, newName) => {
            if (!item.data) return item;
            return { ...item, data: { ...item.data, displayName: newName } };
          }
        );
      } catch (error) {
        console.error('🚨 Error creating data provider:', error);
        return new StaticTreeDataProvider<HierarchicalTreeNode>({}, (item) => item);
      }
    },
    [items]
  );

  const handleSelectItems = (itemIds: TreeItemIndex[]) => {
    if (itemIds.length === 0 || itemIds[0] === 'root') return;

    const itemId = itemIds[0];
    const item = items[itemId];
    if (!item || !item.data) return;

    const node = item.data as HierarchicalTreeNode;

    // Handle selection in data service
    dataService.current.selectNode(node.id);

    // Handle navigation
    if (node.viewInfo) {
      const mainViewService = MainViewService.getInstance();
      mainViewService.navigateTo(node.viewInfo);
    }
  };

  console.log('🌲 Rendering tree with', Object.keys(items).length, 'items');

  if (Object.keys(items).length <= 1) { // Only root or less
    return (
      <LeftPanel isVisible={isVisible} width={280}>
        <div className={styles.treeContainer}>
          <div style={{ padding: '20px', color: 'red' }}>No tree data available (only {Object.keys(items).length} items)</div>
        </div>
      </LeftPanel>
    );
  }

  return (
    <LeftPanel isVisible={isVisible} width={280}>
      <div className={styles.treeContainer}>
        <div style={{ padding: '10px', background: 'yellow', marginBottom: '10px', zIndex: 1000 }}>
          Tree has {Object.keys(items).length} items. Root has {items.root?.children?.length || 0} children.
        </div>
        <div style={{ height: 'calc(100% - 60px)', overflow: 'auto' }}>
          <ControlledTreeEnvironment<HierarchicalTreeNode>
            items={items}
            getItemTitle={(item) => {
              const title = item.data?.displayName || `Item ${item.index}`;
              console.log('🎨 getItemTitle called for:', item.index, '→', title);
              return title;
            }}
            viewState={{
              'hierarchical-tree': {
                expandedItems,
                selectedItems,
                focusedItem,
              },
            }}
            onExpandItem={(item) => setExpandedItems([...expandedItems, item.index])}
            onCollapseItem={(item) => setExpandedItems(expandedItems.filter(id => id !== item.index))}
            onSelectItems={(itemIds) => {
              setSelectedItems(itemIds);
              if (itemIds.length > 0 && itemIds[0] !== 'root') {
                const itemId = itemIds[0];
                const item = items[itemId];
                if (item?.data) {
                  const node = item.data;
                  dataService.current.selectNode(node.id);
                  if (node.viewInfo) {
                    const mainViewService = MainViewService.getInstance();
                    mainViewService.navigateTo(node.viewInfo);
                  }
                }
              }
            }}
            onFocusItem={(item) => setFocusedItem(item.index)}
            canDragAndDrop={true}
            canDropOnFolder={false}
            canReorderItems={true}
          >
            <Tree treeId="hierarchical-tree" rootItem="root" treeLabel="Navigation Tree" />
          </ControlledTreeEnvironment>
        </div>
      </div>
    </LeftPanel>
  );
};
