import { FC } from 'react';
import { NodeRendererProps } from 'react-arborist';
import { ViewInfo } from '../MainView/MainView';
import styles from './HierarchicalTreeNode.module.css';

export interface TreeNodeData {
  id: string;
  name: string;
  collapsed?: boolean;
  children?: TreeNodeData[];
  viewInfo?: ViewInfo;
}

interface NodeProps extends NodeRendererProps<TreeNodeData> {
  onNavigate: (viewInfo: ViewInfo) => void;
}

export const Node: FC<NodeProps> = ({ node, onNavigate, style, dragHandle }) => {
  const handleClick = (e: React.MouseEvent) => {
    if (node.data.children) {
      node.toggle();
    } else if (node.data.viewInfo) {
      onNavigate(node.data.viewInfo);
    }
  };

  return (
    <div
      className={`${styles.node} ${node.data.id === 'add_cohort' ? styles.addCohortNode : ''}`}
      style={style}
      {...dragHandle}
      onClick={handleClick}
    >
      <div className={styles.arrow}>
        {node.data.children && (
          <span
            className={styles.caret}
            style={{ transform: node.isOpen ? 'rotate(90deg)' : 'none' }}
          >
            ▶
          </span>
        )}
      </div>
      <span className={styles.nodeName}>{node.data.name}</span>
    </div>
  );
};
