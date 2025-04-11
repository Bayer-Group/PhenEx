import React from 'react';
import styles from './ValueFilterCellRenderer.module.css';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';

interface ValueFilter {
  class_name: 'ValueFilter';
  min: {
    class_name: 'Value';
    operator: string;
    value: number;
  } | null;
  max: {
    class_name: 'Value';
    operator: string;
    value: number;
  } | null;
  column_name: string;
}

interface AndFilter {
  class_name: 'AndFilter';
  filter1: ValueFilter;
  filter2: ValueFilter;
}

const ValueFilterCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const formatValueFilter = (filter: ValueFilter): JSX.Element => {
    return (
      <div className={styles.filterContent}>
        <span className={styles.columnName}>{filter.column_name}</span>
        {filter.min && (
          <span className={`${styles.filterValue} ${styles.min}`}>
            <span className={`${styles.operator} ${styles.min}`}>{filter.min.operator} </span>
            {filter.min.value}
          </span>
        )}
        {filter.max && (
          <span className={`${styles.filterValue} ${styles.max}`}>
            <span className={`${styles.operator} ${styles.max}`}>{filter.max.operator} </span>
            {filter.max.value}
          </span>
        )}
      </div>
    );
  };

  const formatFilter = (value: ValueFilter | AndFilter): JSX.Element[] => {
    if (value.class_name === 'AndFilter') {
      return [formatValueFilter(value.filter1), formatValueFilter(value.filter2)];
    }
    return [formatValueFilter(value)];
  };

  const filterPhenotypes = ['MeasurementPhenotype', 'AgePhenotype'];
  if (!filterPhenotypes.includes(props.data.class_name) || !props.value || props.value === null) {
    return <div></div>;
  }

  const filters = formatFilter(props.value);

  return (
    <PhenexCellRenderer {...props}>
      <div className={styles.filtersContainer}>
        {filters.map((filter, index) => (
          <div key={index} className={styles.filterRow}>
            {filter}
          </div>
        ))}
      </div>
    </PhenexCellRenderer>
  );
};

export default ValueFilterCellRenderer;
