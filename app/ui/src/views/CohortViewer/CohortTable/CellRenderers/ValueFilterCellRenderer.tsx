import React from 'react';
import styles from './ValueFilterCellRenderer.module.css';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';
import { ValueFilter, AndFilter } from '../CellEditors/valueFilterEditor/types';
const ValueFilterCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const formatValueFilter = (filter: ValueFilter): JSX.Element => {
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

  const formatFilter = (value: ValueFilter | AndFilter): JSX.Element[] => {
    if (value.class_name === 'AndFilter') {
      return [formatValueFilter(value.filter1), formatValueFilter(value.filter2)];
    }
    return [formatValueFilter(value)];
  };

  if (!props.value || typeof props.value === null) {
    return (
      <PhenexCellRenderer {...props}>
        <div></div>
      </PhenexCellRenderer>
    );
  }

  const filters = formatFilter(props.value);

  return (
    <PhenexCellRenderer {...props}>
      <div className={styles.filtersContainer}>
        {filters.map((filter, index) => (
          <div
            key={index}
            className={styles.filterRow}
            onClick={() => {
              props.api?.startEditingCell({
                rowIndex: props.node?.rowIndex ?? 0,
                colKey: props.column?.getColId() ?? '',
              });
            }}
          >
            {filter}
          </div>
        ))}
      </div>
    </PhenexCellRenderer>
  );
};

export default ValueFilterCellRenderer;
