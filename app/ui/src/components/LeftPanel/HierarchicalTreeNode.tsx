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
  onClickAdd?: () => void;
}

export const Node: FC<NodeProps> = ({ node, onNavigate, onClickAdd, style, dragHandle }) => {
  const handleClick = (e: React.MouseEvent) => {
    if (node.data.children) {
      node.toggle();
    } else if (node.data.viewInfo) {
      onNavigate(node.data.viewInfo);
    }
    node.focus();
  };

  const clickedOnAddButton = (e: React.MouseEvent) => {
    // onNavigate(node.data.viewInfo);
    console.log('CLICKED ADD BUTTON IN NODE', node.data.name);
    onClickAdd(node.data.name);
  };

  if (node.data.id === 'cohorts') {
    return (
      <div className={`${styles.headerNode}`} style={style} {...dragHandle}>
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
        <button className={styles.addButton} onClick={clickedOnAddButton}>
          Create cohort
        </button>
      </div>
    );
  }

  return (
    <div
      className={`${styles.node} ${node.data.id === 'add_cohort' ? styles.addCohortNode : ''} ${node.isSelected ? styles.selected : ''}`}
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
