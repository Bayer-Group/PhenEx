import React, { useState, useEffect } from 'react';
import styles from './CategoricalFilterEditor.module.css';
import { FilterType } from './types';
import { SingleCategoricalFilterEditor } from './SingleCategoricalFilterEditor';

interface CategoricalFilterEditorProps {
  value?: FilterType;
  onValueChange?: (value: FilterType) => void;
}

export const CategoricalFilterEditor: React.FC<CategoricalFilterEditorProps> = ({
  value,
  onValueChange,
}) => {
  const createEmptyFilter = () => ({
    class_name: 'CategoricalFilter',
    column_name: '',
    allowed_values: [],
    domain: '',
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
      setFilter(value);
    }
  }, [value]);

  useEffect(() => {
    if (JSON.stringify(filter) !== JSON.stringify(value)) {
      onValueChange?.(filter);
    }
  }, [filter]);

  const deleteCategoricalFilter = (filterToDelete: FilterType) => {
    const traverseAndUpdate = (filterNode: FilterType): FilterType => {
      if (filterNode.class_name === 'AndFilter' || filterNode.class_name === 'OrFilter') {
        if (filterNode.filter1.id === filterToDelete.id) {
          console.log(
            'PARENT IS LOGICAL AND ELETEING CHILD 1',
            filterNode.filter1.column_name,
            filterToDelete.column_name
          );
          return filterNode.filter2;
        }
        if (filterNode.filter2.id === filterToDelete.id) {
          console.log(
            'PARENT IS LOGICAL AND ELETEING CHILD 2',
            filterNode.filter2.column_name,
            filterToDelete.column_name
          );
          return filterNode.filter1;
        }
        return {
          ...filterNode,
          filter1: traverseAndUpdate(filterNode.filter1),
          filter2: traverseAndUpdate(filterNode.filter2),
        };
      } else if (filterNode.id === filterToDelete.id) {
        console.log('DELTING SINGLE NODE', filterNode.column_name, filterToDelete.column_name);
        return {
          ...createEmptyFilter(),
          id: Math.random().toString(36),
        };
      } else {
        console.log('NOT TARGET FILTER', filterNode.column_name);
      }
      return filterNode;
    };
    console.log('STARING DELETION OF FULL FILTER', filter);
    const updatedFilter = traverseAndUpdate(filter);
    console.log('AFTER DELETION OF FULL FILTER', updatedFilter);
    setFilter(updatedFilter);
  };

  const handleFilterChange = (newFilter: FilterType) => {
    const traverseAndUpdate = (filterNode: FilterType): FilterType => {
      if (filterNode.id === newFilter.id) {
        console.log('REACHED TARGET FILTER', filterNode, newFilter);
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
    console.log('SAVED CHANGES TO FILTER', updatedFilter, newFilter);
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
            class_name: 'CategoricalFilter',
            column_name: '',
            allowed_values: [],
            domain: '',
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
      case 'CategoricalFilter':
        return (
          <>
            <div className={styles.filterContainer}>
              <SingleCategoricalFilterEditor
                key={currentFilter.id}
                value={currentFilter}
                onValueChange={handleFilterChange}
                onDelete={deleteCategoricalFilter}
                onIsEditing={onIsEditingSingleFilter}
                createLogicalFilter={createLogicalFilter}
              />
            </div>
          </>
        );
      case 'AndFilter':
      case 'OrFilter':
        return (
          <>
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
                  <div className = {currentFilter.filter2.class_name === 'CategoricalFilter'? styles.lastCategoricalFilter:''}
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
          </>
        );
    }
  };

  return <div className={styles.container}>{renderFilter(filter)}</div>;
};
