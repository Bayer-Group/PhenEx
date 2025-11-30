import React from 'react';
import styles from '../CategoricalFilterCellRenderer.module.css';
import { FilterType, SingleLogicalExpression } from '../../CellEditors/logicalExpressionEditor/types';

export interface LogicalExpressionRendererProps {
  value: FilterType | null | undefined;
  onFilterClick?: (filter: FilterType, path: number[]) => void;
  path?: number[];
}

/**
 * LogicalExpressionRenderer - Reusable component for rendering logical expressions
 * Can be used in both CellRenderers and CellEditors
 * 
 * @param value - The filter tree to render
 * @param onFilterClick - Optional callback when a filter unit is clicked, receives the filter and its path
 * @param path - Internal tracking of the path to this filter in the tree
 */
export const LogicalExpressionRenderer: React.FC<LogicalExpressionRendererProps> = ({
  value,
  onFilterClick,
  path = [],
}) => {
  const renderFilter = (filter: FilterType | null | undefined, currentPath: number[]): React.JSX.Element => {
    if (!filter) {
      return <div className={styles.filterText}></div>;
    }
  console.log("RENDERING A LOGIC !!!!!!")

    if (filter.class_name === 'LogicalExpression') {
      const logicalExpression = filter as SingleLogicalExpression;
      return (
        <div
          className={styles.unit}
          onClick={(e) => {
            e.stopPropagation();
            if (onFilterClick) {
              onFilterClick(filter, currentPath);
            }
          }}
          style={{ cursor: onFilterClick ? 'pointer' : 'default' }}
        >
          <div className={styles.top}>{logicalExpression.phenotype_name}</div>
          <div className={styles.bottom}></div>
        </div>
      );
    }

    if ('filter1' in filter && 'filter2' in filter) {
      const isRootLevel = currentPath.length === 0;
      return (
        <>
          <span className={styles.punctuation}>{isRootLevel ? '' : '('}</span>
          {renderFilter(filter.filter1, [...currentPath, 1])}
          <span className={styles.logicalOperator}>
            {filter.class_name === 'OrFilter' ? '|' : '&'}
          </span>
          {renderFilter(filter.filter2, [...currentPath, 2])}
          <span className={styles.punctuation}>{isRootLevel ? '' : ')'}</span>
        </>
      );
    }

    return <div className={styles.filterText}>Invalid filter type</div>;
  };

  return <div className={styles.fullText}>{renderFilter(value, path)}</div>;
};
