import { FC, useState, useEffect, useRef } from 'react';
import { LeftPanel } from './LeftPanel';
import styles from './HierarchicalLeftPanel.module.css';
import AccordionList from '../../components/AccordionList/AccordionList';
import { AccordionNode } from '../../components/AccordionList/AccordionListItem';
import { StudyAccordionListItem } from '../../components/AccordionList/StudyAccordionListItem';
import { CohortAccordionListItem } from '../../components/AccordionList/CohortAccordionListItem';
import { HierarchicalTreeNode } from './CohortTreeListItem.tsx';
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

  // Convert HierarchicalTreeNode to AccordionNode and assign proper renderers
  const convertToAccordionData = (nodes: HierarchicalTreeNode[]): AccordionNode[] => {
    return nodes.map(node => {
      const convertedChildren = convertToAccordionData(node.children as HierarchicalTreeNode[]);
      
      const accordionNode: AccordionNode = {
        displayName: node.displayName,
        level: node.level,
        children: convertedChildren as any, // Type assertion to bypass the renderer type mismatch
        onClick: node.onClick,
        height: node.height,
        selected: node.selected,
        collapsed: node.collapsed,
        fontSize: node.fontSize,
        fontFamily: node.fontFamily,
        hasButton: node.hasButton,
        buttonTitle: node.buttonTitle,
        buttonOnClick: node.buttonOnClick,
        classNameArrow: node.classNameArrow,
        classNameButton: node.classNameButton,
        id: node.id,
        viewInfo: node.viewInfo,
      };

      // Assign the appropriate renderer based on node type/level
      if (node.level === 0) {
        // Root level nodes (My Studies, Public Studies) - use default renderer
        accordionNode.renderer = undefined;
      } else if (node.level === 1) {
        // Study level nodes - use StudyAccordionListItem
        accordionNode.renderer = StudyAccordionListItem;
      } else if (node.level === 2) {
        // Cohort level nodes - use CohortAccordionListItem
        accordionNode.renderer = CohortAccordionListItem;
      }

      return accordionNode;
    });
  };

  const accordionData = convertToAccordionData(treeData);

  return (
    <LeftPanel isVisible={isVisible} width={280}>
      <div
        className={styles.treeContainer}
        style={{ width: '100%', height: '100%' }}
        ref={containerRef}
      >
        <AccordionList data={accordionData} />
      </div>
    </LeftPanel>
  );
};
