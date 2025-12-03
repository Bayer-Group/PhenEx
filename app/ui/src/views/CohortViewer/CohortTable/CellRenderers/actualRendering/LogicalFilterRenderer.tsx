import React from 'react';
import styles from './LogicalFilterRenderer.module.css';
import type { FlattenedItem } from '../../../../../hooks/useLogicalFilterEditor';

export interface LogicalFilterRendererProps<T> {
  flattenedItems: FlattenedItem<T>[];
  renderFilter: (filter: T) => React.ReactNode;
  onItemClick?: (item: FlattenedItem<T>) => void;
  onOperatorClick?: (path: number[]) => void;
  selectedIndex?: number;
  filterClassName?: string; // CSS class for filter items
  operatorClassName?: string; // CSS class for operator items
  selectedClassName?: string; // CSS class for selected filter
}

/**
 * LogicalFilterRenderer - Generic component for rendering logical filter trees
 * 
 * Displays flattened filter trees with:
 * - Individual filter items (clickable to edit)
 * - Logical operators (AND/OR) between filters (clickable to toggle)
 * - Parentheses for grouping
 * - Visual selection highlighting
 * 
 * Works with any filter type (CategoricalFilter, LogicalExpression, etc.)
 */
export function LogicalFilterRenderer<T>({
  flattenedItems,
  renderFilter,
  onItemClick,
  onOperatorClick,
  selectedIndex,
  filterClassName = '',
  operatorClassName = '',
  selectedClassName = '',
}: LogicalFilterRendererProps<T>) {
  
  if (!flattenedItems || flattenedItems.length === 0) {
    return <div className={styles.empty}></div>;
  }

  return (
    <div className={styles.container}>
      {flattenedItems.map((item) => {
        switch (item.type) {
          case 'filter': {
            const isSelected = selectedIndex !== undefined && selectedIndex === item.index;
            const classes = `${styles.filterItem} ${filterClassName} ${isSelected && selectedClassName ? selectedClassName : ''}`.trim();
            
            return (
              <div
                key={`filter-${item.index}`}
                className={classes}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('LogicalFilterRenderer - filter clicked, onItemClick:', !!onItemClick, 'item:', item);
                  onItemClick?.(item);
                }}
                style={{ cursor: onItemClick ? 'pointer' : 'default' }}
              >
                {renderFilter(item.filter)}
              </div>
            );
          }
          
          case 'operator': {
            const classes = `${styles.operator} ${operatorClassName}`.trim();
            
            return (
              <div
                key={`operator-${item.index}`}
                className={classes}
                onClick={(e) => {
                  e.stopPropagation();
                  onOperatorClick?.(item.path);
                }}
                style={{ cursor: onOperatorClick ? 'pointer' : 'default' }}
                title={onOperatorClick ? 'Click to toggle AND/OR' : undefined}
              >
                {item.operator}
              </div>
            );
          }
          
          case 'parenthesis': {
            return (
              <span
                key={`paren-${item.index}`}
                className={styles.parenthesis}
              >
                {item.paren}
              </span>
            );
          }
          
          default:
            return null;
        }
      })}
    </div>
  );
}
