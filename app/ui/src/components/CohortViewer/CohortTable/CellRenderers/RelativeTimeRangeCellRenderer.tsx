import React from 'react';
import editPencilIcon from '../../../../assets/icons/edit-pencil.svg';
import deleteIcon from '../../../../assets/icons/delete.svg';
import styles from './RelativeTimeRangeCellRenderer.module.css';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';

interface RelativeTimeRangeFilter {
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

const RelativeTimeRangeCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const formatTimeRange = (filter: RelativeTimeRangeFilter): JSX.Element => {
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
        <span className={`${styles.timeValue} ${styles.min}`}>
          <span className={`${styles.operator} ${styles.min}`}>{filter.min_days.operator} </span>
          {filter.min_days.value}
        </span>
        <span className={`${styles.timeValue} ${styles.max}`}>
          <span className={`${styles.operator} ${styles.max}`}>{filter.max_days.operator} </span>
          {filter.max_days.value}
        </span>
        days <span className={styles.when}>{filter.when}</span>
        <span className={styles.reference}> {reference} </span>
      </span>
    );
  };

  let filters: RelativeTimeRangeFilter[] = props.value || [];
  if (props.data.type == 'entry') {
    return <div>not applicable</div>;
  }
  return (
    <PhenexCellRenderer {...props}>
      <div className={styles.filtersContainer}>
        {filters.map((filter, index) => (
          <div key={index} className={styles.filterRow}>
            {formatTimeRange(filter)}<br/>
          </div>
        ))}
      </div>
    </PhenexCellRenderer>
  );
};

export default RelativeTimeRangeCellRenderer;
