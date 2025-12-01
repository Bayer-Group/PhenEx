import React from 'react';
import styles from '../ValueFilterCellRenderer.module.css';
import { ValueFilter, AndFilter } from '../../CellEditors/valueFilterEditor/types';
import { ComplexItemRenderer } from './ComplexItemRenderer';
import typeStyles from '../../../../../styles/study_types.module.css';

export type ValueFilterValue = ValueFilter | AndFilter | null | undefined;

export interface ValueFilterRendererProps {
  value: ValueFilterValue;
  data?: any;
  onClick?: () => void;
  onItemClick?: (item: ValueFilter, index: number) => void;
}

/**
 * ValueFilterRenderer - Reusable component for rendering value filter constraints
 * Can be used in both CellRenderers and CellEditors
 * 
 * @param value - The value filter(s) to render
 * @param data - Row data for accessing effective_type and other row-level properties
 * @param onClick - Optional callback when a filter is clicked
 * @param onItemClick - Optional callback when an individual filter item is clicked
 */
export const ValueFilterRenderer: React.FC<ValueFilterRendererProps> = ({
  value,
  data,
  onItemClick,
}) => {


  const effectiveType = data?.effective_type;
  const borderColorClass = typeStyles[`${effectiveType || ''}_border_color`] || '';
  const colorClass = typeStyles[`${effectiveType || ''}_text_color`] || '';

  const formatValueFilter = (filter: ValueFilter): React.JSX.Element => {
    return (
      <div className={`${styles.filterContent} ${colorClass}`}>
        <span className={styles.columnName}>{filter.column_name}</span>
        {filter.min_value && (
          <span className={`${styles.filterValue} ${styles.min}`}>
            <span className={`${styles.operator} ${styles.min}`}>{filter.min_value.operator} </span>
            {filter.min_value.value}
          </span>
        )}
        {filter.max_value && (
          <span className={`${styles.filterValue} ${styles.max}`}>
            <span className={`${styles.operator} ${styles.max_value}`}>
              {filter.max_value.operator}{' '}
            </span>
            {filter.max_value.value}
          </span>
        )}
      </div>
    );
  };

  const getFilters = (filterValue: ValueFilter | AndFilter): ValueFilter[] => {
    if (filterValue.class_name === 'AndFilter') {
      return [filterValue.filter1, filterValue.filter2];
    }
    return [filterValue];
  };

  if (!value || typeof value === null) {
    return null;
  }
  const filters = getFilters(value);
  return (
    <ComplexItemRenderer
      items={filters}
      renderItem={(filter) => (
        <div className={styles.filtersContainer}>
          {formatValueFilter(filter)}
        </div>
      )}
      onItemClick={onItemClick}
      itemClassName={borderColorClass}
      emptyPlaceholder={null}
    />
  );
};
