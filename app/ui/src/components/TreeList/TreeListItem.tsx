import React from 'react';
import styles from './TreeList.module.css';
import { Button } from '../ButtonsAndTabs/Button/Button';

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
  classNameArrow?: string; // Optional CSS class for the toggle arrow
  classNameButton?: string; // Optional CSS class for the button
}

export interface TreeItemRendererProps {
  node: TreeNode;
  isOpen: boolean;
  onToggle: () => void;
  additionalProps?: Record<string, any>;
  // Pass the caret element to the renderer so it can style and position it
  caretElement?: React.ReactElement | null;
  defaultArrowClassName?: string;
}

export interface TreeListItemProps {
  node: TreeNode;
  onToggle?: (isOpen: boolean) => void;
  rendererProps?: Record<string, any>;
  classNameArrow?: string;
  classNameButton?: string;
  isLastChild?: boolean; // Whether this is the last child in its parent's children array
  hideButton?: boolean; // Whether to hide button by default and show on hover
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

    // Create an array of indices up to current level for vertical lines
    const renderVerticalLines = () => {
      const lines = [];
      // Start from level 1 (not 0) up to current level
      for (let i = 0; i <= node.level; i++) {
        // Only apply lastChild class to the last vertical line (at current node's level)
        const isLastChildClass = (this.props.isLastChild && i === node.level) ? styles.lastChild : '';
        lines.push(
          <div key={`line-${i}`} className={`${styles.verticalLine} ${styles[`level${i}`]} ${isLastChildClass}`} />
        );
      }
      return lines;
    };

    // Create the default caret element that can be passed to renderer
    const createCaretElement = (customClassName?: string) => {
      const finalArrowClassName = customClassName || node.classNameArrow || this.props.classNameArrow || '';
      
      return node.children.length > 0 ? (
        <div className={styles.toggleContainer}>
          <button
            className={`${styles.toggleButton} ${isOpen ? styles.open : ''} ${finalArrowClassName}`}
            onClick={e => {
              e.stopPropagation();
              this.toggleOpen();
            }}
          >
            {'>'}
          </button>
        </div>
      ) : null;
    };

    // If using a custom renderer, let it handle the entire layout including caret
    if (Renderer) {
      const defaultArrowClassName = node.classNameArrow || this.props.classNameArrow || '';
      const caretElement = createCaretElement(defaultArrowClassName);
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
              <Renderer
                node={node}
                isOpen={isOpen}
                onToggle={this.toggleOpen}
                additionalProps={this.props.rendererProps}
                caretElement={caretElement}
                defaultArrowClassName={defaultArrowClassName}
              />
              {node.hasButton && (
                <Button
                  title={node.buttonTitle}
                  onClick={() => clickedOnButton(new MouseEvent('click') as any)}
                  className={`${styles.button} ${this.props.node.hideButton ? styles.buttonHidden : ''}`.trim()}
                />
              )}
            </div>
          </div>
          {isOpen && node.children.length > 0 && (
            <div className={styles.children}>
              {node.children.map((child, index) => (
                <TreeListItem
                  key={`${child.displayName}-${index}`}
                  node={child}
                  rendererProps={this.props.rendererProps}
                  classNameArrow={child.classNameArrow || this.props.classNameArrow}
                  isLastChild={index === node.children.length - 1}
                  hideButton={this.props.node.hideButton}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    // Default rendering when no custom renderer
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
            {createCaretElement()}
            {node.hasButton && (
              <Button
                title={node.buttonTitle}
                onClick={() => clickedOnButton(new MouseEvent('click') as any)}
                className={`${styles.button} ${this.props.hideButton ? styles.buttonHidden : ''}`.trim()}
              />
            )}
            <div className={styles.content}>
              {this.renderDefaultContent()}
            </div>
          </div>
        </div>
        {isOpen && node.children.length > 0 && (
          <div className={styles.children}>
            {node.children.map((child, index) => (
              <TreeListItem
                key={`${child.displayName}-${index}`}
                node={child}
                rendererProps={this.props.rendererProps}
                classNameArrow={child.classNameArrow || this.props.classNameArrow}
                isLastChild={index === node.children.length - 1}
                hideButton={this.props.node.hideButton}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
}
