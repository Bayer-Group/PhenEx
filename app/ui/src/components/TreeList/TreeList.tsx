import React from 'react';
import styles from './TreeList.module.css';
import { TreeListItem, TreeNode } from './TreeListItem';

interface TreeListProps {
  data: TreeNode[];
}

const TreeList: React.FC<TreeListProps> = ({ data }) => {
  return (
    <div className={styles.treeList}>
      {data.map((node, index) => {
        console.log("THIS IS NODE", node)
        const ItemComponent = node.renderer || TreeListItem;
        return <ItemComponent key={`${node.displayName}-${index}`} node={node} />;
      })}
    </div>
  );
};

export default TreeList;
