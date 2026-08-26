import React from 'react';
import styles from '../ValueFilterCellRenderer.module.css';
import { ValueFilter, AndFilter } from '../../CellEditors/valueFilterEditor/types';
import { LogicalFilterRenderer, FlattenedItem } from './LogicalFilterRenderer';
import typeStyles from '../../../../../styles/study_types.module.css';

// Legacy data may store a value filter as an AndFilter or an array; the current
// model is always a single ValueFilter.
export type ValueFilterValue = ValueFilter | AndFilter | ValueFilter[] | null | undefined;

export interface ValueFilterRendererProps {
  value: ValueFilterValue;
  data?: any;
  onClick?: () => void;
  onItemClick?: (item: ValueFilter, index: number, event?: React.MouseEvent) => void;
  selectedIndex?: number; // Index of the currently selected item (for visual highlighting)
  selectedClassName?: string; // Optional className to apply to the selected item
}

/**
 * Coerce any accepted shape (single filter, AndFilter, or array) down to a
 * single ValueFilter. Returns null when there is nothing to render.
 */
const toSingleFilter = (value: ValueFilterValue): ValueFilter | null => {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  if (value.class_name === 'AndFilter') return value.filter1 ?? null;
  return value;
};

/**
 * ValueFilterRenderer - Renders a single value filter constraint.
 * Used in both CellRenderers and CellEditors.
 */
export const ValueFilterRenderer: React.FC<ValueFilterRendererProps> = ({
  value,
  data,
  onItemClick,
  selectedIndex,
  selectedClassName,
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

  const filter = toSingleFilter(value);
  if (!filter) {
    return null;
  }

  const flattenedItems: FlattenedItem<ValueFilter>[] = [
    { type: 'filter', filter, index: 0, path: [0] },
  ];

  return (
    <LogicalFilterRenderer
      flattenedItems={flattenedItems}
      renderFilter={f => (
        <div className={styles.filtersContainer}>{formatValueFilter(f)}</div>
      )}
      onItemClick={onItemClick}
      filterClassName={borderColorClass}
      selectedIndex={selectedIndex}
      selectedClassName={selectedClassName}
    />
  );
};
