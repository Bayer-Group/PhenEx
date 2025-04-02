import React, { useState } from 'react';
import styles from './ValueFilterEditor.module.css';
import { ValueFilter, AndFilter } from './types';

interface ValueFilterEditorProps {
  value?: ValueFilter | AndFilter;
  onValueChange?: (value: ValueFilter | AndFilter) => void;
}

export const ValueFilterEditor: React.FC<ValueFilterEditorProps> = ({
  value = [],
  onValueChange,
}) => {
  const [filters, setFilters] = useState<ValueFilter[]>(() => {
    if (value) {
      if (value.class_name === 'AndFilter') {
        return [value.filter1, value.filter2];
      } else {
        return [value];
      }
    }
    return [
      {
        class_name: 'ValueFilter',
        min: { class_name: 'Value', operator: '>=', value: '' },
        max: { class_name: 'Value', operator: '<', value: '' },
        column_name: '',
      },
    ];
  });

  const updateFilter = (index: number, updates: Partial<ValueFilter>) => {
    const newFilters = [...filters];
    newFilters[index] = {
      ...newFilters[index],
      ...updates,
      class_name: 'ValueFilter',
      min: updates.min !== undefined ? updates.min : newFilters[index].min,
      max: updates.max !== undefined ? updates.max : newFilters[index].max,
      column_name: updates.column_name !== undefined ? updates.column_name : newFilters[index].column_name,
    };
    setFilters(newFilters);
    
    if (newFilters.length === 1) {
      onValueChange?.(newFilters[0]);
    } else if (newFilters.length === 2) {
      onValueChange?.({
        class_name: 'AndFilter',
        filter1: newFilters[0],
        filter2: newFilters[1],
      });
    }
  };

  const addFilter = () => {
    if (filters.length >= 2) return; // Limit to 2 filters for AndFilter
    const newFilter: ValueFilter = {
      class_name: 'ValueFilter',
      min: { class_name: 'Value', operator: '>=', value: '' },
      max: { class_name: 'Value', operator: '<', value: '' },
      column_name: '',
    };
    const newFilters = [...filters, newFilter];
    setFilters(newFilters);
    
    if (newFilters.length === 1) {
      onValueChange?.(newFilter);
    } else if (newFilters.length === 2) {
      onValueChange?.({
        class_name: 'AndFilter',
        filter1: newFilters[0],
        filter2: newFilters[1],
      });
    }
  };

  const removeFilter = (index: number) => {
    const updatedFilters = filters.filter((_, i) => i !== index);
    setFilters(updatedFilters);
    
    if (updatedFilters.length === 0) {
      onValueChange?.(null);
    } else if (updatedFilters.length === 1) {
      onValueChange?.(updatedFilters[0]);
    } else if (updatedFilters.length === 2) {
      onValueChange?.({
        class_name: 'AndFilter',
        filter1: updatedFilters[0],
        filter2: updatedFilters[1],
      });
    }
  };

  return (
    <div className={styles.container}>
      {filters.map((filter, index) => (
        <div key={index} className={styles.filterRow}>
          <label>Column Name:</label>
          <input
            className={styles.column_name}
            value={filter.column_name}
            onChange={e => updateFilter(index, { column_name: e.target.value })}
            placeholder="Enter column name"
          />
          <div className={styles.filterSection}>
            <label>Min Value:</label>
            <select
              value={filter.min?.operator || '>='}
              onChange={e =>
                updateFilter(index, {
                  min: { class_name: 'Value', operator: e.target.value as '>' | '>=', value: filter.min?.value || '' },
                })
              }
              className={styles.select}
            >
              <option value=">">&gt;</option>
              <option value=">=">&gt;=</option>
            </select>
            <input
              type="number"
              value={filter.min?.value || ''}
              onChange={e =>
                updateFilter(index, {
                  min: { class_name: 'Value', operator: filter.min?.operator || '>=', value: e.target.value },
                })
              }
              className={styles.input}
              placeholder="Enter min value"
            />
          </div>

          <div className={styles.filterSection}>
            <label>Max Value:</label>
            <select
              value={filter.max?.operator || '<'}
              className={styles.select}
              onChange={e => {
                const newMax = {
                  class_name: 'Value',
                  operator: e.target.value as '<' | '<=',
                  value: filter.max?.value || '',
                };
                updateFilter(index, { max: newMax });
              }}
            >
              <option value="<">&lt;</option>
              <option value="<=">&lt;=</option>
            </select>
            <input
              type="number"
              value={filter.max?.value || ''}
              className={styles.input}
              placeholder="Enter max value"
              onChange={e => {
                const newMax = {
                  class_name: 'Value',
                  operator: filter.max?.operator || '<',
                  value: e.target.value,
                };
                updateFilter(index, { max: newMax });
              }}
            />
          </div>

          <button
            className={styles.deleteButton}
            onClick={() => removeFilter(index)}
            aria-label="Remove filter"
          >
            ×
          </button>
        </div>
      ))}
      <button className={styles.addButton} onClick={addFilter}>
        Click to add a value filter
      </button>
    </div>
  );
};
