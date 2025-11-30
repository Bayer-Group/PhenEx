import React from 'react';
import styles from '../ValueFilterCellRenderer.module.css';
import { ValueFilter, AndFilter } from '../../CellEditors/valueFilterEditor/types';

export type ValueFilterValue = ValueFilter | AndFilter | null | undefined;

export interface ValueFilterRendererProps {
  value: ValueFilterValue;
  data?: any;
  onClick?: () => void;
}

/**
 * ValueFilterRenderer - Reusable component for rendering value filter constraints
 * Can be used in both CellRenderers and CellEditors
 * 
 * @param value - The value filter(s) to render
 * @param onClick - Optional callback when a filter is clicked
 */
export const ValueFilterRenderer: React.FC<ValueFilterRendererProps> = ({
  value,
  onClick,
}) => {
  const formatValueFilter = (filter: ValueFilter): React.JSX.Element => {
    return (
      <div className={styles.filterContent}>
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

  const formatFilter = (filterValue: ValueFilter | AndFilter): React.JSX.Element[] => {
    if (filterValue.class_name === 'AndFilter') {
      return [formatValueFilter(filterValue.filter1), formatValueFilter(filterValue.filter2)];
    }
    return [formatValueFilter(filterValue)];
  };

  if (!value || typeof value === null) {
    return null;
  }

  const filters = formatFilter(value);

  return (
    <div 
      className={styles.filtersContainer}
      style={{ 
        width: '100%', 
        height: '100%', 
        backgroundColor: 'transparent' 
      }}
    >
      {filters.map((filter, index) => (
        <div
          key={index}
          className={styles.filterRow}
          onClick={(e) => {
            e.stopPropagation();
            if (onClick) {
              onClick();
            }
          }}
          style={{ cursor: onClick ? 'pointer' : 'default' }}
        >
          {filter}
        </div>
      ))}
    </div>
  );
};
