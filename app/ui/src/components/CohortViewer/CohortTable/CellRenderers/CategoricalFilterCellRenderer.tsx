import React from 'react';
import styles from './CategoricalFilterCellRenderer.module.css';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';
import { FilterType, BaseCategoricalFilter } from '../../CellEditors/categoricalFilterEditor/types';

const CategoricalFilterCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const renderFilter = (filter: FilterType | null | undefined, isRoot:boolean): JSX.Element => {
    if (!filter) {
      return <div className={styles.filterText}></div>;
    }

    if (filter.class_name === 'CategoricalFilter') {
      const categoricalFilter = filter as BaseCategoricalFilter;
      return (
        <>
          <div className={styles.unit}>
            <div className={styles.top}>{categoricalFilter.allowed_values.join(', ')}</div>
            <div className={styles.bottom}>{categoricalFilter.column_name}</div>
          </div>
        </>
      );
    }

    if ('filter1' in filter && 'filter2' in filter) {
      return (
        <>
          <span className={styles.punctuation}>{isRoot?'':'('}</span>
          {renderFilter(filter.filter1, false)}
          <span className={styles.logicalOperator}>
            {filter.class_name === 'OrFilter' ? '|' : '&'}
          </span>
          {renderFilter(filter.filter2, false)}
          <span className={styles.punctuation}>{isRoot?'':')'}</span>
        </>
      );
    }

    return <div className={styles.filterText}>Invalid filter type</div>;
  };

  return (
    <PhenexCellRenderer {...props}>
      <div className={styles.fullText}>{renderFilter(props.value as FilterType, true)}</div>
    </PhenexCellRenderer>
  );
};

export default CategoricalFilterCellRenderer;
