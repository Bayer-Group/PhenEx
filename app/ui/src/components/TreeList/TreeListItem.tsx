import React, { useState } from 'react';
import styles from './TreeList.module.css';

export interface TreeNode {
  displayName: string;
  level: number;
  children: TreeNode[];
  treeListItem?: React.ComponentType<TreeListItemProps>;
}

export interface TreeListItemProps {
  node: TreeNode;
  onToggle?: (isOpen: boolean) => void;
}

export class TreeListItem extends React.Component<TreeListItemProps> {
  state = {
    isOpen: false
  };

  toggleOpen = () => {
    const newIsOpen = !this.state.isOpen;
    this.setState({ isOpen: newIsOpen });
    this.props.onToggle?.(newIsOpen);
  };

  renderChildren() {
    const { node } = this.props;
    const { isOpen } = this.state;

    if (!isOpen || node.children.length === 0) {
      return null;
    }

    return (
      <div className={styles.children}>
        {node.children.map((child, index) => {
          const ItemComponent = child.treeListItem || TreeListItem;
          return (
            <ItemComponent
              key={`${child.displayName}-${index}`}
              node={child}
            />
          );
        })}
      </div>
    );
  }

  render() {
    const { node } = this.props;
    const { isOpen } = this.state;

    return (
      <div className={styles.treeItem}>
        <div 
          className={styles.container} 
          style={{ 
            '--level': node.level,
          } as React.CSSProperties}
        >
          <div className={styles.verticalLine} />
          <button 
            className={`${styles.toggleButton} ${isOpen ? styles.open : ''}`}
            onClick={this.toggleOpen}
          >
            {node.children.length > 0 && <span>▶</span>}
          </button>
          <div className={styles.content}>
            {node.displayName}
          </div>
        </div>
        {this.renderChildren()}
      </div>
    );
  }
}
