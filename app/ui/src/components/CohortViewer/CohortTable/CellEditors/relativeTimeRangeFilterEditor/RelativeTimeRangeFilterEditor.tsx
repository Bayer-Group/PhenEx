import React, { useState, useEffect } from 'react';
import styles from './RelativeTimeRangeFilterEditor.module.css';
import { TimeRangeFilter } from './types';
import deleteIcon from '../../../../../assets/icons/delete.svg';

interface RelativeTimeRangeFilterEditorProps {
  value?: TimeRangeFilter[];
  onValueChange?: (value: TimeRangeFilter[]) => void;
}

export const RelativeTimeRangeFilterEditor: React.FC<RelativeTimeRangeFilterEditorProps> = ({
  value,
  onValueChange,
}) => {
  const [filters, setFilters] = useState<TimeRangeFilter[]>(() => {
    if (value && Array.isArray(value)) {
      return value.map(filter => ({
        class_name: 'RelativeTimeRangeFilter',
        min_days: filter.min_days === null ? null : {
          class_name: 'Value',
          operator: filter.min_days?.operator || '>',
          value: filter.min_days?.value ?? 0,
        },
        max_days: filter.max_days === null ? null : {
          class_name: 'Value',
          operator: filter.max_days?.operator || '<',
          value: filter.max_days?.value ?? 365,
        },
        when: filter.when || 'before',
        useConstant: filter.useConstant ?? false,
        useIndexDate: filter.useIndexDate ?? true,
        anchor_phenotype: filter.anchor_phenotype ?? null,
        constant: filter.constant,
      }));
    }
    return [
      {
        class_name: 'RelativeTimeRangeFilter',
        min_days: { class_name: 'Value', operator: '>', value: 0 },
        max_days: { class_name: 'Value', operator: '<', value: 365 },
        when: 'before',
        useConstant: false,
        useIndexDate: true,
        anchor_phenotype: null,
      },
    ];
  });

  useEffect(() => {
    if (onValueChange && filters !== value) {
      onValueChange(filters);
      console.log("ON vALUE CHANGE", filters)
    }
  }, [filters]);

  const updateFilter = (index: number, updates: Partial<TimeRangeFilter>) => {
    const newFilters = [...filters];
    newFilters[index] = {
      ...newFilters[index],
      ...updates,
      class_name: 'RelativeTimeRangeFilter',
      min_days: updates.min_days === null ? null : {
        ...newFilters[index].min_days,
        class_name: 'Value',
        ...(updates.min_days || {}),
      },
      max_days: updates.max_days === null ? null : {
        ...newFilters[index].max_days,
        class_name: 'Value',
        ...(updates.max_days || {}),
      },
      useConstant: updates.useConstant ?? newFilters[index].useConstant ?? false,
      constant: updates.constant || newFilters[index].constant,
      useIndexDate: updates.useIndexDate ?? newFilters[index].useIndexDate ?? true,
      anchor_phenotype: updates.anchor_phenotype ?? newFilters[index].anchor_phenotype ?? null,
    };
    console.log("UPDATED FILTER", newFilters)
    setFilters(newFilters);
  };

  const addNewFilter = () => {
    setFilters([
      ...filters,
      {
        class_name: 'RelativeTimeRangeFilter',
        min_days: { class_name: 'Value', operator: '>', value: 0 },
        max_days: { class_name: 'Value', operator: '<', value: 365 },
        when: 'before',
        useIndexDate: true,
        anchor_phenotype: null,
      },
    ]);
  };

  const deleteFilter = (index: number) => {
    const newFilters = filters
      .filter((_, i) => i !== index)
      .map(filter => ({
        ...filter,
        class_name: 'RelativeTimeRangeFilter',
        min_days: {
          class_name: 'Value',
          operator: filter.min_days?.operator || '>',
          value: filter.min_days?.value ?? 0,
        },
        max_days: {
          class_name: 'Value',
          operator: filter.max_days?.operator || '<',
          value: filter.max_days?.value ?? 365,
        },
        when: filter.when || 'before',
        useConstant: filter.useConstant ?? false,
        useIndexDate: filter.useIndexDate ?? true,
        anchor_phenotype: filter.anchor_phenotype ?? null,
        constant: filter.constant,
      }));
    setFilters(newFilters);
  };

  return (
    <div className={styles.manualContent}>
      {filters.map((filter, index) => (
        <div key={index} className={styles.timerangefilter} style={{ position: 'relative' }}>
          <button
            onClick={() => deleteFilter(index)}
            className={styles.deleteButton}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img src={deleteIcon} alt="Delete filter" width="16" height="16" />
          </button>
          <div className={styles.filterSection}>
            <label>
              <input
                type="checkbox"
                checked={filter.useConstant}
                onChange={e => updateFilter(index, { useConstant: e.target.checked })}
              />
              Use Constant
            </label>
          </div>

          {filter.useConstant ? (
            <div className={styles.filterSection}>
              <select
                value={filter.constant || 'one_year_pre_index'}
                onChange={e =>
                  updateFilter(index, { constant: e.target.value as TimeRangeFilter['constant'] })
                }
                className={styles.select}
              >
                <option value="one_year_pre_index">One Year Pre-Index</option>
                <option value="any_time_post_index">Any Time Post-Index</option>
              </select>
            </div>
          ) : (
            <>
              <div className={styles.filterSection}>
                <label>Min Days:</label>
                <select
                  value={filter.min_days?.operator || 'not set'}
                  onChange={e => {
                    const operator = e.target.value;
                    console.log("SETTING MIN DAYS")
                    if (operator === 'not set') {
                      console.log("SETTINT TO NULL")
                      updateFilter(index, { min_days: null });
                    } else {
                      updateFilter(index, {
                        min_days: { 
                          class_name: 'Value',
                          operator: operator as '>' | '>=',
                          value: filter.min_days?.value ?? 0
                        },
                      }
                    );
                    }
                    console.log("AND AFTER SETTTING", filter)

                  }}
                  className={styles.select}
                >
                  <option value="not set">Not Set</option>
                  <option value=">">&gt;</option>
                  <option value=">=">&gt;=</option>
                </select>
                {filter.min_days && (
                  <input
                    type="number"
                    value={filter.min_days.value}
                    onChange={e =>
                      updateFilter(index, {
                        min_days: { ...filter.min_days, value: parseInt(e.target.value) || 0 },
                      })
                    }
                    className={styles.input}
                    placeholder="0"
                  />
                )}
              </div>

              <div className={styles.filterSection}>
                <label>Max Days:</label>
                <select
                  value={filter.max_days?.operator || 'not set'}
                  onChange={e => {
                    const operator = e.target.value;
                    if (operator === 'not set') {
                      updateFilter(index, { max_days: null });
                    } else {
                      updateFilter(index, {
                        max_days: { 
                          class_name: 'Value',
                          operator: operator as '<' | '<=',
                          value: filter.max_days?.value ?? 365
                        },
                      });
                    }
                  }}
                  className={styles.select}
                >
                  <option value="not set">Not Set</option>
                  <option value="<">&lt;</option>
                  <option value="<=">&lt;=</option>
                </select>
                {filter.max_days && (
                  <input
                    type="number"
                    value={filter.max_days.value}
                    onChange={e =>
                      updateFilter(index, {
                        max_days: { ...filter.max_days, value: parseInt(e.target.value) || 365 },
                      })
                    }
                    className={styles.input}
                  />
                )}
              </div>

              <div className={styles.filterSection}>
                <label>When:</label>
                <select
                  value={filter.when}
                  onChange={e =>
                    updateFilter(index, { when: e.target.value as 'before' | 'after' | 'range' })
                  }
                  className={styles.select}
                >
                  <option value="before">Before</option>
                  <option value="after">After</option>
                  <option value="range">Range</option>
                </select>
              </div>

              <div className={styles.filterSection}>
                <label>
                  <input
                    type="checkbox"
                    checked={filter.useIndexDate}
                    onChange={e => updateFilter(index, { useIndexDate: e.target.checked })}
                  />
                  Index Date
                </label>
                {!filter.useIndexDate && (
                  <select
                    value={filter.anchor_phenotype || ''}
                    onChange={e => updateFilter(index, { anchor_phenotype: e.target.value })}
                    className={styles.select}
                  >
                    <option value="">Select Anchor Phenotype...</option>
                    <option value="one">one</option>
                    <option value="two">two</option>
                    <option value="three">three</option>
                  </select>
                )}
              </div>
            </>
          )}
        </div>
      ))}
      <button onClick={addNewFilter} className={styles.addButton}>
        Click to add a Time Range Filter
      </button>
    </div>
  );
};
