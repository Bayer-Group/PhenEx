import React from 'react';
import styles from './AccordionList.module.css';
import { TreeNode } from '../TreeList/TreeListItem';
import { HierarchicalLeftPanelDataService } from '../../views/LeftPanel/HierarchicalLeftPanelDataService';

export interface AccordionItemRendererProps {
  node: AccordionNode;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: (nodeId: string) => void;
  additionalProps?: Record<string, any>;
}

export interface AccordionNode extends Omit<TreeNode, 'renderer'> {
  id: string;
  viewInfo?: any;
  renderer?: React.ComponentType<AccordionItemRendererProps>;
}

export interface AccordionListItemProps {
  node: AccordionNode;
  onToggle?: (isExpanded: boolean) => void;
  onSelect?: (nodeId: string) => void;
  rendererProps?: Record<string, any>;
  level?: number;
}

export class AccordionListItem extends React.Component<AccordionListItemProps> {
  state = {
    isExpanded: !this.props.node.collapsed,
  };

  handleToggle = () => {
    const newIsExpanded = !this.state.isExpanded;
    this.setState({ isExpanded: newIsExpanded });
    this.props.onToggle?.(newIsExpanded);
  };

  handleSelect = () => {
    // Use the data service for selection if available
    // const dataService = HierarchicalLeftPanelDataService.getInstance();
    // dataService.selectNode(this.props.node.id);
    
    // this.props.onSelect?.(this.props.node.id);
  };

  handleHeaderClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Handle selection
    this.handleSelect();
    
    // Handle custom onClick if provided
    if (this.props.node.onClick) {
      this.props.node.onClick(e);
    } else if (this.props.node.children.length > 0) {
      // Default behavior: toggle if has children
      this.handleToggle();
    }
  };

  handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (this.props.node.buttonOnClick) {
      this.props.node.buttonOnClick();
    }
  };

  renderDefaultContent() {
    const { node } = this.props;
    const { isExpanded } = this.state;
    const hasChildren = node.children.length > 0;

    return (
      <div className={styles.accordionItem}>
        <div 
          className={`${styles.accordionHeader} ${node.selected ? styles.selected : ''}`}
          onClick={this.handleHeaderClick}
        >
          <div className={styles.headerContent}>
            
            <div className={`${styles.headerText} ${styles.level0}`}>{node.displayName}</div>
{hasChildren && (
              <div 
                className={`${styles.expandIcon} ${isExpanded ? styles.expanded : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  this.handleToggle();
                }}
              >
                ›
              </div>
            )}
          </div>
          
          <div className={styles.headerActions}>
            {node.hasButton && (
              <button
                className={styles.actionButton}
                onClick={this.handleButtonClick}
                title={node.buttonTitle || 'Action'}
              >
                {node.buttonTitle || 'Action'}
              </button>
            )}
          </div>
        </div>

        {hasChildren && (
          <div className={`${styles.accordionContent} ${isExpanded ? styles.expanded : styles.collapsed}`}>
            <div className={styles.childrenContainer}>
              {node.children.map((child, index) => (
                <AccordionListItem
                  key={`${child.displayName}-${index}`}
                  node={child as AccordionNode}
                  onToggle={this.props.onToggle}
                  onSelect={this.props.onSelect}
                  rendererProps={this.props.rendererProps}
                  level={(this.props.level || 0) + 1}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  render() {
    const { node } = this.props;
    const { isExpanded } = this.state;
    const Renderer = node.renderer;

    // If using a custom renderer, pass the accordion context
    if (Renderer) {
      return (
        <Renderer
          node={node}
          isExpanded={isExpanded}
          onToggle={this.handleToggle}
          onSelect={this.handleSelect}
          additionalProps={this.props.rendererProps}
        />
      );
    }

    // Default rendering
    return this.renderDefaultContent();
  }
}