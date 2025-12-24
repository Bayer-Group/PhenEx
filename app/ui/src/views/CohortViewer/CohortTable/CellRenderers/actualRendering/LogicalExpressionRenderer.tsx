import React, { useMemo } from 'react';
import styles from '../CategoricalFilterCellRenderer.module.css';
import { FilterType, SingleLogicalExpression } from '../../CellEditors/logicalExpressionEditor/types';
import typeStyles from '../../../../../styles/study_types.module.css';
import { LogicalFilterRenderer } from './LogicalFilterRenderer';
import type { FlattenedItem } from '../../../../../hooks/useLogicalFilterEditor';

export interface LogicalExpressionRendererProps {
  value: FilterType | null | undefined;
  data?: any;
  onItemClick?: (item: FlattenedItem<SingleLogicalExpression>, index?: number, event?: React.MouseEvent) => void;
  onOperatorClick?: (path: number[]) => void;
  selectedIndex?: number;
  selectedClassName?: string;
}

/**
 * LogicalExpressionRenderer - Reusable component for rendering logical expressions
 * Can be used in both CellRenderers and CellEditors
 * 
 * Uses LogicalFilterRenderer for consistent display of expression trees with operators
 * 
 * @param value - The filter tree to render
 * @param data - Row data for accessing effective_type and other row-level properties
 * @param onItemClick - Optional callback when an expression is clicked
 * @param onOperatorClick - Optional callback when an operator is clicked to toggle
 * @param selectedIndex - Index of currently selected expression for highlighting
 * @param selectedClassName - CSS class to apply to selected expression
 */
export const LogicalExpressionRenderer: React.FC<LogicalExpressionRendererProps> = ({
  value,
  data,
  onItemClick,
  onOperatorClick,
  selectedIndex,
  selectedClassName,
}) => {
  const effectiveType = data?.effective_type;
  const borderColorClass = typeStyles[`${effectiveType || ''}_border_color`] || '';
  const colorBlockClass = typeStyles[`${effectiveType || ''}_color_block`] || '';
  const colorTextClass = typeStyles[`${effectiveType || ''}_text_color`] || '';

  // Flatten the expression tree for rendering
  const flattenedItems = useMemo(() => {
    if (!value) return [];
    
    const items: FlattenedItem<SingleLogicalExpression>[] = [];
    let itemIndex = 0;

    const flatten = (node: FilterType | null | undefined, path: number[], depth: number): void => {
      if (!node || typeof node !== 'object') return;
      
      if (node.class_name === 'LogicalExpression') {
        items.push({
          type: 'filter',
          filter: node as SingleLogicalExpression,
          index: itemIndex++,
          path,
        });
        return;
      }

      // Logical node (AND/OR)
      if (node.class_name === 'AndFilter' || node.class_name === 'OrFilter') {
        const logicalNode = node as any;
        const operator = logicalNode.class_name === 'AndFilter' ? 'AND' : 'OR';

        // Add opening parenthesis for nested expressions (not root)
        if (depth > 0) {
          items.push({ type: 'parenthesis', paren: '(', index: itemIndex++ });
        }

        // Flatten left child
        if (logicalNode.filter1) {
          flatten(logicalNode.filter1, [...path, 1], depth + 1);
        }

        // Add operator
        items.push({
          type: 'operator',
          operator,
          index: itemIndex++,
          path,
        });

        // Flatten right child
        if (logicalNode.filter2) {
          flatten(logicalNode.filter2, [...path, 2], depth + 1);
        }

        // Add closing parenthesis for nested expressions
        if (depth > 0) {
          items.push({ type: 'parenthesis', paren: ')', index: itemIndex++ });
        }
      }
    };

    flatten(value, [], 0);
    return items;
  }, [value]);

  /**
   * Render a single logical expression item
   */
  const renderFilter = (expression: SingleLogicalExpression): React.ReactNode => {
    return (
      <div className={`${styles.unit} ${colorTextClass}`}>
        <div className={styles.top}>{expression.phenotype_name || '(empty)'}</div>
        <div className={styles.bottom}></div>
      </div>
    );
  };

  if (!value) {
    return <div className={styles.empty}></div>;
  }

  return (
    <div className={styles.fullText}>
      <LogicalFilterRenderer
        flattenedItems={flattenedItems}
        renderFilter={renderFilter}
        onItemClick={onItemClick}
        onOperatorClick={onOperatorClick}
        selectedIndex={selectedIndex}
        selectedClassName={selectedClassName || colorBlockClass}
        filterClassName={borderColorClass}
        operatorClassName={colorTextClass}
      />
    </div>
  );
};
