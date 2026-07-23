import React from 'react';
import styles from '../DateRangeCellRenderer.module.css';
import { DateRange } from '../../CellEditors/dateRangeEditor/types';
import typeStyles from '../../../../../styles/study_types.module.css';

export interface DateRangeRendererProps {
  value: DateRange | null | undefined;
  data?: any;
  onClick?: () => void;
  onItemClick?: (item: DateRange, index: number, event?: React.MouseEvent) => void;
  selectedIndex?: number;
  selectedClassName?: string;
}

export const DateRangeRenderer: React.FC<DateRangeRendererProps> = ({
  value,
  data,
  onClick,
  onItemClick,
}) => {
  if (!value || value.class_name !== 'ValueFilter') return null;

  const effectiveType = data?.effective_type;
  const colorClass = typeStyles[`${effectiveType || ''}_text_color`] || '';

  const handleClick = (event: React.MouseEvent) => {
    if (onItemClick) {
      onItemClick(value, 0, event);
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <div className={`${styles.filterContent} ${colorClass}`} onClick={handleClick}>
      <span className={styles.columnName}>{value.column_name}</span>
      {value.min_value && (
        <span className={styles.constraint}>
          <span className={styles.operator}>{value.min_value.operator}</span>
          <span className={styles.date}>{value.min_value.value.__datetime__}</span>
        </span>
      )}
      {value.max_value && (
        <span className={styles.constraint}>
          <span className={styles.operator}>{value.max_value.operator}</span>
          <span className={styles.date}>{value.max_value.value.__datetime__}</span>
        </span>
      )}
    </div>
  );
};
