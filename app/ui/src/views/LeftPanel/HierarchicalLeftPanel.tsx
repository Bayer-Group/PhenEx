import { FC, useState, useEffect, useRef, useMemo } from 'react';
import { ControlledTreeEnvironment, Tree, TreeItemIndex, TreeItem, TreeEnvironmentRef, InteractionMode } from 'react-complex-tree';
import 'react-complex-tree/lib/style-modern.css';
import { LeftPanel } from './LeftPanel';
import styles from './HierarchicalLeftPanel.module.css';
import { HierarchicalTreeNode } from './HierarchicalLeftPanelDataService';
import { HierarchicalLeftPanelDataService } from './HierarchicalLeftPanelDataService';
import { MainViewService } from '../MainView/MainView';
import { SimpleCustomScrollbar } from '../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar.tsx';
import { useNavigate } from 'react-router-dom';

interface HierarchicalLeftPanelProps {
  isVisible: boolean;
}

// Convert HierarchicalTreeNode to react-complex-tree format
const convertToComplexTree = (nodes: HierarchicalTreeNode[]): Record<TreeItemIndex, TreeItem<HierarchicalTreeNode>> => {
  
  const items: Record<TreeItemIndex, TreeItem<HierarchicalTreeNode>> = {
    root: {
      index: 'root',
      isFolder: true,
      children: nodes.map(n => n.id),
      data: undefined as any,
    },
  };


  const processNode = (node: HierarchicalTreeNode) => {
    const hasChildren = node.children && node.children.length > 0;
    items[node.id] = {
      index: node.id,
      isFolder: hasChildren,
      children: hasChildren ? (node.children as HierarchicalTreeNode[]).map(c => c.id) : undefined,
      data: node,
    };
    

    if (hasChildren) {
      (node.children as HierarchicalTreeNode[]).forEach(processNode);
    }
  };

  nodes.forEach(processNode);
  
  return items;
};

export const HierarchicalLeftPanel: FC<HierarchicalLeftPanelProps> = ({ isVisible }) => {
  const [treeData, setTreeData] = useState<HierarchicalTreeNode[]>([]);
  const [expandedItems, setExpandedItems] = useState<TreeItemIndex[]>(['root', 'mystudies']);
  const [selectedItems, setSelectedItems] = useState<TreeItemIndex[]>([]);
  const [focusedItem, setFocusedItem] = useState<TreeItemIndex>();
  const dataService = useRef(HierarchicalLeftPanelDataService.getInstance());
  const treeEnvironmentRef = useRef<TreeEnvironmentRef<HierarchicalTreeNode>>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastClickTime = useRef<{ itemId: TreeItemIndex; time: number } | null>(null);
  const isExpandCollapseAction = useRef(false);
  const isDragging = useRef(false);
  const navigate = useNavigate();

  const DOUBLE_CLICK_THRESHOLD = 300; // ms

  useEffect(() => {
    const updateTreeData = () => {
      const rawTreeData = dataService.current.getTreeData();
      setTreeData(rawTreeData);
    };

    updateTreeData();
    dataService.current.addListener(updateTreeData);

    return () => dataService.current.removeListener(updateTreeData);
  }, []);

  const items = useMemo(() => {
    const converted = convertToComplexTree(treeData);
    return converted;
  }, [treeData]);

  const handleItemClick = (itemId: TreeItemIndex, item: TreeItem<HierarchicalTreeNode>) => {
    const now = Date.now();
    const lastClick = lastClickTime.current;

    // Check for double-click
    if (lastClick && lastClick.itemId === itemId && now - lastClick.time < DOUBLE_CLICK_THRESHOLD) {
      // Double-click detected - trigger rename
      console.log('✏️ Double-click detected on:', itemId);
      
      // Focus the item first
      if (treeEnvironmentRef.current) {
        treeEnvironmentRef.current.focusItem(itemId, 'hierarchical-tree');
      }
      
      // Simulate F2 key press to trigger rename
      setTimeout(() => {
        const event = new KeyboardEvent('keydown', { key: 'F2' });
        document.dispatchEvent(event);
      }, 50);
      
      lastClickTime.current = null; // Reset
      return;
    }

    // Update last click time
    lastClickTime.current = { itemId, time: now };

    // Single click - handle selection and navigation
    if (!item.data) return;
    const node = item.data;

    // Handle special action items
    if (node.id === 'new-study-action') {
      dataService.current.addNewStudy();
      return;
    }

    // DON'T toggle if item is a folder and is already expanded
    // The arrow click will handle toggling
    const isExpanded = expandedItems.includes(itemId);
    if (item.isFolder && isExpanded) {
      console.log('📁 Item already expanded, not toggling on label click');
      // Just handle selection/navigation, don't toggle
    }

    // Handle selection
    dataService.current.selectNode(node.id);
    if (node.viewInfo) {
      const mainViewService = MainViewService.getInstance();
      mainViewService.navigateTo(node.viewInfo);
    }
  };

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
        <div 
          ref={scrollContainerRef}
          className={styles.scrollContainer}
        >
          <ControlledTreeEnvironment<HierarchicalTreeNode>
            ref={treeEnvironmentRef}
            items={items}
            getItemTitle={(item) => {
              const title = item.data?.displayName || `Item ${item.index}`;
              return title;
            }}
            renderItemTitle={({ title, item }) => {
              const node = item.data;
              const hasButton = node?.hasButton && node?.buttonTitle && node?.buttonOnClick;
              
              // Determine the level of this item
              let level = 0;
              if (item.index === 'mystudies' || item.index === 'publicstudies') {
                level = 0; // Root items
              } else {
                // Find parent to determine level
                const parentItem = Object.values(items).find(i => i.children?.includes(item.index as string));
                if (parentItem) {
                  if (parentItem.index === 'mystudies' || parentItem.index === 'publicstudies') {
                    level = 1; // Studies
                  } else if (parentItem.index === 'root') {
                    level = 0;
                  } else {
                    // Check if parent is a study (level 1)
                    const grandParentItem = Object.values(items).find(i => i.children?.includes(parentItem.index as string));
                    if (grandParentItem && (grandParentItem.index === 'mystudies' || grandParentItem.index === 'publicstudies')) {
                      level = 2; // Cohorts
                    } else {
                      level = 3; // Deeper nesting
                    }
                  }
                }
              }
              
              const levelClass = `level${level}`;
              
              return (
                <div 
                  className={`${styles.itemTitle} ${styles[levelClass]}`}
                >
                  <span>{title}</span>
                  {hasButton && (
                    <span
                      className={styles.nodeButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        node.buttonOnClick?.();
                      }}
                      title={node.buttonTitle}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          node.buttonOnClick?.();
                        }
                      }}
                    >
                      {node.buttonTitle}
                    </span>
                  )}
                </div>
              );
            }}
            viewState={{
              'hierarchical-tree': {
                expandedItems,
                selectedItems,
                focusedItem,
              },
            }}
            defaultInteractionMode={InteractionMode.ClickArrowToExpand}
            canRename={true}
            canInvokePrimaryActionOnItemContainer={false}
            onRenameItem={(item, newName) => {
              
              if (!item.data) {
                console.warn('⚠️ No data for item:', item.index);
                return;
              }

              const node = item.data;
              
              // Prevent renaming special action items
              if (node.id === 'new-study-action') {
                console.warn('⚠️ Cannot rename action items');
                return;
              }

              // Determine if this is a study or cohort and update accordingly
              const parentItem = Object.values(items).find(i => i.children?.includes(item.index as string));
              const isStudy = parentItem && (parentItem.index === 'mystudies' || parentItem.index === 'publicstudies');
              const isCohort = !isStudy && parentItem && parentItem.index !== 'root';

              // Handle async updates
              (async () => {
                if (isStudy) {
                  // It's a study - check if it's public
                  const isPublic = parentItem.index === 'publicstudies';
                  
                  if (isPublic) {
                    console.log('⚠️ Cannot rename public study');
                    return;
                  }

                  // Update study name via data service
                  try {
                    await dataService.current.updateStudyName(node.id, newName);
                  } catch (error) {
                    console.error('Failed to rename study:', error);
                  }
                } else if (isCohort) {
                  
                  // Update cohort name via data service
                  try {
                    await dataService.current.updateCohortName(node.id, newName);
                  } catch (error) {
                    console.error('Failed to rename cohort:', error);
                  }
                } else {
                  console.warn('⚠️ Cannot determine item type for rename');
                }
              })();
            }}
            onExpandItem={(item) => {
              isExpandCollapseAction.current = true;
              setExpandedItems([...expandedItems, item.index]);
              // Reset flag after a short delay
              setTimeout(() => {
                isExpandCollapseAction.current = false;
              }, 50);
            }}
            onCollapseItem={(item) => {
              isExpandCollapseAction.current = true;
              setExpandedItems(expandedItems.filter(id => id !== item.index));
              // Reset flag after a short delay
              setTimeout(() => {
                isExpandCollapseAction.current = false;
              }, 50);
            }}
            onSelectItems={(itemIds) => {
              // Don't handle selection if it's from expand/collapse or drag action
              if (isExpandCollapseAction.current || isDragging.current) {
                setSelectedItems(itemIds); // Still update selected items visually
                return;
              }
              
              setSelectedItems(itemIds);
              if (itemIds.length > 0 && itemIds[0] !== 'root') {
                const itemId = itemIds[0];
                const item = items[itemId];
                if (item?.data) {
                  const node = item.data;
                  
                  // Handle special action items
                  if (node.id === 'new-study-action') {
                    dataService.current.addNewStudy();
                    return;
                  }
                  
                  // Handle root items that navigate to /studies
                  if (node.id === 'mystudies' || node.id === 'publicstudies') {
                    navigate('/studies');
                    return;
                  }
                  
                  dataService.current.selectNode(node.id);
                  if (node.viewInfo) {
                    // Check if we should navigate to a URL
                    if (node.viewInfo.data?.navigateTo) {
                      navigate(node.viewInfo.data.navigateTo);
                    } else if (node.viewInfo.viewType === 'studyViewer') {
                      // Navigate to study URL
                      navigate(`/studies/${node.viewInfo.data}`);
                    } else if (node.viewInfo.viewType === 'sdef' || node.viewInfo.viewType === 'psdef') {
                      // Navigate to cohort URL - need to find study_id from cohort data
                      const cohortData = typeof node.viewInfo.data === 'string' ? { id: node.viewInfo.data } : node.viewInfo.data;
                      const cohortId = cohortData?.id || node.viewInfo.data;
                      
                      // Find the parent study from the tree
                      const parentItem = Object.values(items).find(i => i.children?.includes(itemId as string));
                      const studyId = parentItem?.data?.id;
                      
                      if (studyId && cohortId) {
                        navigate(`/studies/${studyId}/cohorts/${cohortId}`);
                      } else {
                        // Fallback to MainViewService if we can't construct URL
                        const mainViewService = MainViewService.getInstance();
                        mainViewService.navigateTo(node.viewInfo);
                      }
                    } else {
                      // Use traditional navigation for other view types
                      const mainViewService = MainViewService.getInstance();
                      console.log("NAVIGATING TO:", node.viewInfo);
                      mainViewService.navigateTo(node.viewInfo);
                    }
                  }
                }
              }
            }}
            onFocusItem={(item) => setFocusedItem(item.index)}
            onDrop={(draggedItems, target) => {
              // Mark that we're in a drag operation to prevent selection
              isDragging.current = true;
              
              // Get the dragged item IDs
              const draggedIds = draggedItems.map(item => item.index as string);
              
              // Only handle single item drag for now
              if (draggedIds.length !== 1) {
                console.warn('⚠️ Multiple item drag not supported yet');
                return;
              }

              const draggedId = draggedIds[0];
              const targetParentId = target.targetType === 'between-items' 
                ? target.parentItem 
                : target.targetType === 'item'
                ? target.targetItem
                : null;
                
              
              // Handle reordering within the same parent
              if (target.targetType === 'between-items') {
                let childIndex = target.childIndex ?? 0;
                
                // Get the current index of the dragged item to determine if moving up or down
                const parentItem = items[targetParentId as string];
                if (parentItem?.children) {
                  const currentIndex = parentItem.children.indexOf(draggedId);
                  console.log('🎯 Current index of dragged item:', currentIndex);
                  console.log('🎯 Target index:', childIndex);
                  
                  // If moving upward (to a lower index), the childIndex is already correct
                  // because the library calculates it as the "insert before" position
                  // If moving downward (to a higher index), we need to adjust by -1
                  // because we'll remove the item first, shifting indices down
                  if (currentIndex < childIndex) {
                    // Moving down: adjust index to account for removal
                    childIndex = childIndex - 1;
                    console.log('🎯 Adjusted index for downward move:', childIndex);
                  }
                }
                
                console.log('🎯 Final child index:', childIndex);
                
                // Check if reordering studies
                if (targetParentId === 'mystudies' || targetParentId === 'publicstudies') {
                  // Reorder studies
                  dataService.current.reorderStudy(targetParentId as string, draggedId, childIndex);
                } else {
                  // Check if reordering cohorts within a study
                  // The targetParentId should be a study ID
                  if (parentItem?.data) {
                    console.log('🎯 Reordering cohort within study:', targetParentId);
                    dataService.current.reorderCohort(targetParentId as string, draggedId, childIndex);
                  } else {
                    console.warn('⚠️ Drop target not supported:', target.targetType, targetParentId);
                  }
                }
              } else {
                console.warn('⚠️ Drop target type not supported:', target.targetType);
              }
              
              // Reset dragging flag after drop is complete
              setTimeout(() => {
                isDragging.current = false;
              }, 100);
            }}
            canDragAndDrop={true}
            canDropOnFolder={true}
            canReorderItems={true}
          >
            <Tree treeId="hierarchical-tree" rootItem="root" treeLabel="Navigation Tree" />
          </ControlledTreeEnvironment>
        </div>
        <SimpleCustomScrollbar 
          targetRef={scrollContainerRef}
          orientation="vertical"
          marginBottom={20}
          marginToEnd={3}
        />
      </div>
    </LeftPanel>
  );
};
