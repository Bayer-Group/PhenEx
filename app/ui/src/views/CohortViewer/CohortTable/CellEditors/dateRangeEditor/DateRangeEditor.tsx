import React, { useState, useEffect } from 'react';
import styles from './DateRangeEditor.module.css';
import { DateRange, DateConstraint } from './types';

interface DateRangeEditorProps {
  value: DateRange;
  onValueChange: (value: DateRange) => void;
}

const MIN_OPERATORS = [
  { value: 'not set', label: 'Not Set' },
  { value: '>=', label: 'After Or On (≥)' },
  { value: '>', label: 'After (>)' },
] as const;

const MAX_OPERATORS = [
  { value: 'not set', label: 'Not Set' },
  { value: '<=', label: 'Before Or On (≤)' },
  { value: '<', label: 'Before (<)' },
] as const;

const CLASS_NAME_FOR_OPERATOR: Record<string, DateConstraint['class_name']> = {
  '>=': 'AfterOrOn',
  '>': 'After',
  '<=': 'BeforeOrOn',
  '<': 'Before',
};

const DEFAULT_COLUMN_NAME = 'EVENT_DATE';

const createDefaultDateRange = (): DateRange => ({
  class_name: 'ValueFilter',
  min_value: null,
  max_value: null,
  column_name: DEFAULT_COLUMN_NAME,
});

const formatDateString = (raw: string): string => {
  // Accept YYYY MM DD (space-separated) or YYYY-MM-DD
  return raw.replace(/\s+/g, '-');
};

const isValidDate = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s);

export const DateRangeEditor: React.FC<DateRangeEditorProps> = ({ value, onValueChange }) => {
  const [filter, setFilter] = useState<DateRange>(() => value ?? createDefaultDateRange());

  useEffect(() => {
    if (onValueChange) {
      onValueChange(filter);
    }
  }, [filter]);

  const update = (updates: Partial<DateRange>) => {
    setFilter(prev => ({ ...prev, ...updates }));
  };

  const getMinOperator = (): string => filter.min_value?.operator ?? 'not set';
  const getMaxOperator = (): string => filter.max_value?.operator ?? 'not set';
  const getMinDate = (): string => filter.min_value?.value.__datetime__ ?? '';
  const getMaxDate = (): string => filter.max_value?.value.__datetime__ ?? '';

  const handleMinOperatorChange = (op: string) => {
    if (op === 'not set') {
      update({ min_value: null });
    } else {
      const currentDate = getMinDate();
      update({
        min_value: {
          class_name: CLASS_NAME_FOR_OPERATOR[op] as 'AfterOrOn' | 'After',
          operator: op as '>=' | '>',
          value: { __datetime__: currentDate },
          date_format: null,
        },
      });
    }
  };

  const handleMaxOperatorChange = (op: string) => {
    if (op === 'not set') {
      update({ max_value: null });
    } else {
      const currentDate = getMaxDate();
      update({
        max_value: {
          class_name: CLASS_NAME_FOR_OPERATOR[op] as 'BeforeOrOn' | 'Before',
          operator: op as '<=' | '<',
          value: { __datetime__: currentDate },
          date_format: null,
        },
      });
    }
  };

  const handleMinDateChange = (raw: string) => {
    const date = formatDateString(raw);
    if (!filter.min_value) return;
    update({
      min_value: {
        ...filter.min_value,
        value: { __datetime__: date },
      },
    });
  };

  const handleMaxDateChange = (raw: string) => {
    const date = formatDateString(raw);
    if (!filter.max_value) return;
    update({
      max_value: {
        ...filter.max_value,
        value: { __datetime__: date },
      },
    });
  };

  const minOp = getMinOperator();
  const maxOp = getMaxOperator();

  return (
    <div className={styles.container}>
      <div className={styles.filterSection}>
        <label className={styles.label}>Column:</label>
        <input
          className={styles.columnInput}
          value={filter.column_name}
          onChange={e => update({ column_name: e.target.value })}
          placeholder="Column name"
        />
      </div>

      <div className={styles.filterSection}>
        <label className={styles.label}>Min Date:</label>
        <select
          className={styles.select}
          value={minOp}
          onChange={e => handleMinOperatorChange(e.target.value)}
        >
          {MIN_OPERATORS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {minOp !== 'not set' && (
          <input
            className={`${styles.dateInput} ${
              isValidDate(getMinDate()) ? '' : styles.invalid
            }`}
            value={getMinDate()}
            onChange={e => handleMinDateChange(e.target.value)}
            placeholder="YYYY-MM-DD"
          />
        )}
      </div>

      <div className={styles.filterSection}>
        <label className={styles.label}>Max Date:</label>
        <select
          className={styles.select}
          value={maxOp}
          onChange={e => handleMaxOperatorChange(e.target.value)}
        >
          {MAX_OPERATORS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {maxOp !== 'not set' && (
          <input
            className={`${styles.dateInput} ${
              isValidDate(getMaxDate()) ? '' : styles.invalid
            }`}
            value={getMaxDate()}
            onChange={e => handleMaxDateChange(e.target.value)}
            placeholder="YYYY-MM-DD"
          />
        )}
      </div>
    </div>
  );
};
