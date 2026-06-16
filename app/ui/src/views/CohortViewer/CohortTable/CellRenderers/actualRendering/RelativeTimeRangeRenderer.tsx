import React from 'react';
import styles from '../RelativeTimeRangeCellRenderer.module.css';
import { LogicalFilterRenderer, FlattenedItem } from './LogicalFilterRenderer';
import typeStyles from '../../../../../styles/study_types.module.css';

export interface RelativeTimeRangeFilter {
  class_name: 'RelativeTimeRangeFilter';
  min_days: {
    class_name: 'Value';
    operator: string;
    value: number;
  };
  max_days: {
    class_name: 'Value';
    operator: string;
    value: number;
  };
  when: string;
  useIndexDate: boolean;
  anchor_phenotype: string | null;
  useConstant: boolean;
  constant?: 'one_year_pre_index' | 'any_time_post_index';
}

export interface RelativeTimeRangeRendererProps {
  value: RelativeTimeRangeFilter[] | null | undefined;
  data?: any;
  onClick?: () => void;
  onItemClick?: (item: RelativeTimeRangeFilter, index: number) => void;
  selectedIndex?: number; // Index of the currently selected item (for visual highlighting)
  selectedClassName?: string; // Optional className to apply to the selected item
}

/**
 * RelativeTimeRangeRenderer - Reusable component for rendering relative time range filters
 * Can be used in both CellRenderers and CellEditors
 * 
 * @param value - Array of time range filters to render
 * @param data - Row data for accessing effective_type and other row-level properties
 * @param onClick - Optional callback when a filter is clicked
 * @param onItemClick - Optional callback when an individual filter item is clicked
 * @param selectedIndex - Index of the currently selected item (for visual highlighting)
 * @param selectedClassName - Optional className to apply to the selected item
 */
export const RelativeTimeRangeRenderer: React.FC<RelativeTimeRangeRendererProps> = ({
  value,
  data,
  onItemClick,
  selectedIndex,
  selectedClassName,
}) => {
  const formatTimeRange = (filter: RelativeTimeRangeFilter): React.JSX.Element => {
    if (filter.useConstant && filter.constant) {
      return (
        <span className={styles.filterRowSpan}>
          {filter.constant}
        </span>
      );
    }

    const reference = filter.useIndexDate
      ? 'index date'
      : filter.anchor_phenotype || 'unknown phenotype';
    return (
      <span className={styles.filterRowSpan}>
        {filter.min_days && (
          <span className={`${styles.timeValue} ${styles.min}`}>
            <span className={`${styles.operator} ${styles.min}`}>{filter.min_days.operator} </span>
            {filter.min_days.value}
          </span>
        )}
        {filter.max_days && (
          <span className={`${styles.timeValue} ${styles.max}`}>
            <span className={`${styles.operator} ${styles.max}`}>{filter.max_days.operator} </span>
            {filter.max_days.value}
          </span>
        )}
        days <span className={styles.when}>{filter.when}</span>
        <span className={styles.reference}> {reference} </span>
      </span>
    );
  };

  const filters: RelativeTimeRangeFilter[] = Array.isArray(value) ? value : [];

  if (filters.length === 0) {
    return null;
  }

  const effectiveType = data?.effective_type;
  const colorClass = typeStyles[`${effectiveType || ''}_text_color`] || '';
  const borderColorClass = typeStyles[`${effectiveType || ''}_border_color`] || '';

  const flattenedItems: FlattenedItem<RelativeTimeRangeFilter>[] = filters.map((filter, index) => ({
    type: 'filter',
    filter: filter,
    index: index,
    path: [index],
  }));

  return (
    <LogicalFilterRenderer
      flattenedItems={flattenedItems}
      renderFilter={(filter) => (
        <div className={`${styles.filtersContainer} ${colorClass}`}>
          {formatTimeRange(filter)}
        </div>
      )}
      onItemClick={onItemClick}
      filterClassName={borderColorClass}
      selectedIndex={selectedIndex}
      selectedClassName={selectedClassName}
    />
  );
};
