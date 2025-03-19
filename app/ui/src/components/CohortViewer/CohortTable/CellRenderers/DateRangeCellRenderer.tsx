import React from 'react';
import styles from './DateRangeCellRenderer.module.css';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';

const DateRangeCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const formatDate = (date: string): string => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(date).toLocaleDateString(undefined, options);
  };

  if (props.data.class_name !== 'date_range_filter' || !props.value) {
    return (<div></div>);
  }

  const { min_date, max_date } = props.value;

  console.log(props.value, min_date, max_date, formatDate(min_date))
  

  return (
    <PhenexCellRenderer {...props}>
      <div className={styles.dateRangeContainer}>
        {min_date && <span>{formatDate(min_date)}</span>}
        {max_date && <span> - {formatDate(max_date)}</span>}
      </div>
    </PhenexCellRenderer>
  );
};

export default DateRangeCellRenderer;
