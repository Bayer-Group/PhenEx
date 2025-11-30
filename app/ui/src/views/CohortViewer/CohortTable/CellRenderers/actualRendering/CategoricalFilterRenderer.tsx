import React from 'react';
import styles from '../CategoricalFilterCellRenderer.module.css';
import { FilterType, BaseCategoricalFilter } from '../../CellEditors/categoricalFilterEditor/types';

export interface CategoricalFilterRendererProps {
  value: FilterType | null | undefined;
  data?: any;
  onFilterClick?: (filter: FilterType, path: number[]) => void;
  path?: number[];
}

/**
 * CategoricalFilterRenderer - Reusable component for rendering categorical filter values
 * Can be used in both CellRenderers and CellEditors
 * 
 * @param value - The filter tree to render
 * @param onFilterClick - Optional callback when a filter unit is clicked, receives the filter and its path
 * @param path - Internal tracking of the path to this filter in the tree
 */
export const CategoricalFilterRenderer: React.FC<CategoricalFilterRendererProps> = ({
  value,
  onFilterClick,
  path = [],
}) => {
  const renderFilter = (filter: FilterType | null | undefined, currentPath: number[]): React.JSX.Element => {
    if (!filter) {
      return <div className={styles.filterText}></div>;
    }

    if (filter.class_name === 'CategoricalFilter') {
      const categoricalFilter = filter as BaseCategoricalFilter;
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
          <div className={styles.top}>{categoricalFilter.allowed_values.join(', ')}</div>
          <div className={styles.bottom}>{categoricalFilter.column_name}</div>
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

  return (
    <div 
      className={styles.fullText}
      style={{ 
        width: '100%', 
        height: '100%', 
        backgroundColor: 'transparent' 
      }}
    >
      {renderFilter(value, path)}
    </div>
  );
};
