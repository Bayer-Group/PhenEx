import React from 'react';
import styles from '../RelativeTimeRangeCellRenderer.module.css';
import { ComplexItemRenderer } from './ComplexItemRenderer';
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
}

/**
 * RelativeTimeRangeRenderer - Reusable component for rendering relative time range filters
 * Can be used in both CellRenderers and CellEditors
 * 
 * @param value - Array of time range filters to render
 * @param data - Row data for accessing effective_type and other row-level properties
 * @param onClick - Optional callback when a filter is clicked
 * @param onItemClick - Optional callback when an individual filter item is clicked
 */
export const RelativeTimeRangeRenderer: React.FC<RelativeTimeRangeRendererProps> = ({
  value,
  data,
  onItemClick,
}) => {
  const formatTimeRange = (filter: RelativeTimeRangeFilter): React.JSX.Element => {
    if (filter.useConstant && filter.constant) {
      return (
        <span className={styles.filterRowSpan}>
          {filter.constant === 'one_year_pre_index' ? 'One Year Pre-Index' : 'Any Time Post-Index'}
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

  return (
    <ComplexItemRenderer
      items={filters}
      renderItem={(filter) => (
        <div className={`${styles.filtersContainer} ${colorClass}`}>
          {formatTimeRange(filter)}
        </div>
      )}
      onItemClick={onItemClick}
      itemClassName={borderColorClass}
      emptyPlaceholder={null}
    />
  );
};
