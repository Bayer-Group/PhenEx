import React, { useState } from 'react';
import styles from './TreeList.module.css';
import { Button } from '../Button/Button';

export interface TreeNode {
  displayName: string;
  level: number;
  children: TreeNode[];
  renderer?: React.ComponentType<TreeItemRendererProps>;
  onClick?: (e: React.MouseEvent) => void;
  height?: number; // Optional height in pixels, defaults to 30 if not specified
  selected?: boolean; // Whether this node is currently selected
  collapsed?: boolean; // Whether this node's children are collapsed/hidden
  fontSize?: number; // Optional font size in pixels
  fontFamily?: string; // Optional font family
  hasButton?: boolean;
  buttonTitle?: string;
  buttonOnClick?: any;
}

export interface TreeItemRendererProps {
  node: TreeNode;
  isOpen: boolean;
  onToggle: () => void;
  additionalProps?: Record<string, any>;
}

export interface TreeListItemProps {
  node: TreeNode;
  onToggle?: (isOpen: boolean) => void;
  rendererProps?: Record<string, any>;
}

export class TreeListItem extends React.Component<TreeListItemProps> {
  state = {
    isOpen: !this.props.node.collapsed,
  };

  handleClick = (e: React.MouseEvent) => {
    const { node } = this.props;

    if (node.onClick) {
      // Use custom click handler if provided
      node.onClick(e);
    } else if (node.children.length > 0) {
      // Default behavior: toggle if has children
      this.toggleOpen();
    }
  };

  toggleOpen = () => {
    const newIsOpen = !this.state.isOpen;
    this.setState({ isOpen: newIsOpen });
    this.props.onToggle?.(newIsOpen);
  };

  renderDefaultContent() {
    const { node } = this.props;
    return <div className={styles.defaultContent}>{node.displayName}</div>;
  }

  render() {
    const { node } = this.props;
    const { isOpen } = this.state;
    const Renderer = node.renderer;

    const clickedOnButton = (e: React.MouseEvent) => {
      e.stopPropagation();
      node.buttonOnClick();
      console.log('CLIKED VUTRONN');
    };

    const content = Renderer ? (
      <Renderer
        node={node}
        isOpen={isOpen}
        onToggle={this.toggleOpen}
        additionalProps={this.props.rendererProps}
      />
    ) : (
      this.renderDefaultContent()
    );

    // Create an array of indices up to current level for vertical lines
    const renderVerticalLines = () => {
      const lines = [];
      // Start from level 1 (not 0) up to current level
      for (let i = 0; i <= node.level; i++) {
        lines.push(
          <div key={`line-${i}`} className={`${styles.verticalLine} ${styles[`level${i}`]}`} />
        );
      }
      return lines;
    };

    const renderCaret = () => {
      return (
        node.children.length > 0 && (
          <div className={styles.toggleContainer}>
            <button
              className={`${styles.toggleButton} ${isOpen ? styles.open : ''}`}
              onClick={e => {
                e.stopPropagation();
                this.toggleOpen();
              }}
            >
              <span>{'>'}</span>
            </button>
          </div>
        )
      );
    };

    return (
      <div className={styles.treeItem}>
        <div
          className={`${styles.container} ${styles[`level${node.level}`]}`}
          onClick={this.handleClick}
        >
          <div
            className={`${styles.itemContent} ${styles[`level${node.level}`]}`}
            style={{
              height: `${node.height || 30}px`,
              fontSize: `${node.fontSize || 20}px`,
              fontFamily: `${node.fontFamily || 'IBMPlexSans-regular'}`,
            }}
          >
            {renderVerticalLines()}
            {renderCaret()}
            {node.hasButton && (
              <Button
                title={node.buttonTitle}
                onClick={clickedOnButton}
                className={styles.button}
              />
            )}
            <div className={styles.content}>{content}</div>
          </div>
        </div>
        {isOpen && node.children.length > 0 && (
          <div className={styles.children}>
            {node.children.map((child, index) => (
              <TreeListItem
                key={`${child.displayName}-${index}`}
                node={child}
                rendererProps={this.props.rendererProps}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
}
