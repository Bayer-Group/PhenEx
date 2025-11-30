import React from 'react';
import styles from '../RelativeTimeRangeCellRenderer.module.css';

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
}

/**
 * RelativeTimeRangeRenderer - Reusable component for rendering relative time range filters
 * Can be used in both CellRenderers and CellEditors
 * 
 * @param value - Array of time range filters to render
 * @param onClick - Optional callback when a filter is clicked
 */
export const RelativeTimeRangeRenderer: React.FC<RelativeTimeRangeRendererProps> = ({
  value,
  onClick,
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
          {formatTimeRange(filter)}
          <br />
        </div>
      ))}
    </div>
  );
};
