import React, { useState, useEffect } from 'react';
import styles from '../categoricalFilterEditor/CategoricalFilterEditor.module.css';
import { FilterType } from './types';
import { SingleLogicalExpressionEditor } from './SingleLogicalExpressionEditor';

interface LogicalExpressionEditorProps {
  value?: FilterType;
  onValueChange?: (value: FilterType) => void;
}

export const LogicalExpressionEditor: React.FC<LogicalExpressionEditorProps> = ({
  value,
  onValueChange,
}) => {
  const createEmptyFilter = () => ({
    class_name: 'LogicalExpression',
    phenotype_name: '',
    phenotype_id: '',
    status: 'empty',
    id: Math.random().toString(36),
  });

  const [filter, setFilter] = useState<FilterType>(() => {
    if (value && typeof value === 'object') {
      return value;
    }
    return createEmptyFilter();
  });

  const [editingSingleFilter, setEditingSingleFilter] = useState(false);

  useEffect(() => {
    if (value && JSON.stringify(filter) !== JSON.stringify(value)) {
      // setFilter(value);
      onValueChange?.(value);
    }
  }, [value]);

  useEffect(() => {
    if (JSON.stringify(filter) !== JSON.stringify(value)) {
      onValueChange?.(filter);
    }
  }, [filter]);

  const deleteLogicalExpression = (filterToDelete: FilterType) => {
    const traverseAndUpdate = (filterNode: FilterType): FilterType => {
      if (filterNode.class_name === 'AndFilter' || filterNode.class_name === 'OrFilter') {
        if (filterNode.filter1.id === filterToDelete.id) {
          return filterNode.filter2;
        }
        if (filterNode.filter2.id === filterToDelete.id) {
          return filterNode.filter1;
        }
        return {
          ...filterNode,
          filter1: traverseAndUpdate(filterNode.filter1),
          filter2: traverseAndUpdate(filterNode.filter2),
        };
      } else if (filterNode.id === filterToDelete.id) {
        return {
          ...createEmptyFilter(),
          id: Math.random().toString(36),
        };
      }
      return filterNode;
    };

    const updatedFilter = traverseAndUpdate(filter);
    console.log('AFTER DELETION OF FULL FILTER', updatedFilter);
    setFilter(updatedFilter);
  };

  const handleFilterChange = (newFilter: FilterType) => {
    const traverseAndUpdate = (filterNode: FilterType): FilterType => {
      if (filterNode.id === newFilter.id) {
        return newFilter;
      }
      if (filterNode.class_name === 'AndFilter' || filterNode.class_name === 'OrFilter') {
        return {
          ...filterNode,
          filter1: traverseAndUpdate(filterNode.filter1),
          filter2: traverseAndUpdate(filterNode.filter2),
        };
      }
      return filterNode;
    };
    const updatedFilter = traverseAndUpdate(filter);
    setFilter(updatedFilter);
  };

  const onIsEditingSingleFilter = (editing: boolean) => {
    setEditingSingleFilter(editing);
  };

  const createLogicalFilter = (type: 'AndFilter' | 'OrFilter', targetFilter: FilterType) => {
    const traverseAndUpdate = (filterNode: FilterType): FilterType => {
      console.log('TRAVERSING AND UPDATING', filterNode, targetFilter);
      if (filterNode.id === targetFilter.id) {
        console.log('REACHED TARGET FILTER', filterNode, targetFilter);
        return {
          class_name: type,
          filter1: targetFilter,
          filter2: {
            class_name: 'LogicalExpression',
            phenotype_name: '',
            phenotype_id: '',
            status: 'empty',
            id: Math.random().toString(36),
          },
        };
      }

      if (filterNode.class_name === 'AndFilter' || filterNode.class_name === 'OrFilter') {
        return {
          ...filterNode,
          filter1: traverseAndUpdate(filterNode.filter1),
          filter2: traverseAndUpdate(filterNode.filter2),
        };
      }

      return filterNode;
    };

    const updatedFilter = traverseAndUpdate(filter);
    console.log('UPDATED FILTER', updatedFilter);
    setFilter(updatedFilter);
  };

  const toggleLogicalOperator = (currentFilter: FilterType) => {
    const traverseAndUpdate = (filterNode: FilterType): FilterType => {
      if (filterNode === currentFilter) {
        return {
          ...filterNode,
          class_name: filterNode.class_name === 'AndFilter' ? 'OrFilter' : 'AndFilter',
        };
      }
      if (filterNode.class_name === 'AndFilter' || filterNode.class_name === 'OrFilter') {
        return {
          ...filterNode,
          filter1: traverseAndUpdate(filterNode.filter1),
          filter2: traverseAndUpdate(filterNode.filter2),
        };
      }
      return filterNode;
    };
    const updatedFilter = traverseAndUpdate(filter);
    setFilter(updatedFilter);
  };

  const renderFilter = (currentFilter: FilterType) => {
    switch (currentFilter.class_name) {
      case 'LogicalExpression':
        return (
          <div className={styles.filterContainer}>
            <SingleLogicalExpressionEditor
              key={currentFilter.id}
              value={currentFilter}
              onValueChange={handleFilterChange}
              onDelete={deleteLogicalExpression}
              onIsEditing={onIsEditingSingleFilter}
              createLogicalFilter={createLogicalFilter}
            />
          </div>
        );
      case 'AndFilter':
      case 'OrFilter':
        return (
          <div className={styles.logicalContainer}>
            <div className={styles.logicalBorderedArea}>
              <div className={styles.filters}>
                {renderFilter(currentFilter.filter1)}
                <div
                  className={styles.logicalOperator}
                  onClick={() => toggleLogicalOperator(currentFilter)}
                  style={{ cursor: 'pointer' }}
                >
                  {currentFilter.class_name === 'AndFilter' ? 'AND' : 'OR'}
                </div>
                <div
                  className={
                    currentFilter.filter2.class_name === 'LogicalExpression'
                      ? styles.lastLogicalExpression
                      : ''
                  }
                >
                  {renderFilter(currentFilter.filter2)}
                </div>
              </div>
            </div>
            <div className={`${styles.logicalButtons} ${styles.logicalLogicalButtons}`}>
              <button
                onClick={e => {
                  e.stopPropagation();
                  createLogicalFilter('AndFilter', currentFilter);
                }}
              >
                AND
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  createLogicalFilter('OrFilter', currentFilter);
                }}
              >
                OR
              </button>
            </div>
          </div>
        );
    }
  };

  return <div className={styles.container}>{renderFilter(filter)}</div>;
};
