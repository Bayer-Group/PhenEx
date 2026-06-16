import React from 'react';
import styles from './ValueFilterEditor.module.css';
import { Value } from './types';

/**
 * Safely converts string input to integer or null
 */
const parseIntegerValue = (stringValue: string): number | null => {
  if (stringValue === '' || stringValue === null || stringValue === undefined) {
    return null;
  }
  const parsed = parseInt(stringValue, 10);
  return isNaN(parsed) ? null : parsed;
};

/**
 * Column name input component
 */
export interface ColumnNameInputProps {
  value: string;
  onChange: (value: string) => void;
}

export const ColumnNameInput: React.FC<ColumnNameInputProps> = ({ value, onChange }) => (
  <>
    <label>Column Name:</label>
    <input
      className={styles.column_name}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="Enter column name"
    />
  </>
);

/**
 * Value range section with operator and input field
 */
export interface ValueRangeSectionProps {
  label: string;
  field: 'min_value' | 'max_value';
  value: Value | null;
  operators: string[];
  onOperatorChange: (operator: string) => void;
  onValueChange: (value: number | null) => void;
}

export const ValueRangeSection: React.FC<ValueRangeSectionProps> = ({
  label,
  value,
  operators,
  onOperatorChange,
  onValueChange,
}) => {
  const currentOperator = value?.operator || 'not set';
  const showInput = currentOperator !== 'not set';

  return (
    <div className={styles.filterSection}>
      <label>{label}:</label>
      <select
        value={currentOperator}
        onChange={e => onOperatorChange(e.target.value)}
        className={styles.select}
      >
        <option value="not set">Not Set</option>
        {operators.map(op => (
          <option key={op} value={op}>
            {op === '>' ? '>' : op === '>=' ? '≥' : op === '<' ? '<' : '≤'}
          </option>
        ))}
      </select>
      {showInput && (
        <input
          type="number"
          value={value?.value ?? ''}
          onChange={e => onValueChange(parseIntegerValue(e.target.value))}
          className={styles.input}
          placeholder={`Enter ${label.toLowerCase()}`}
        />
      )}
    </div>
  );
};

/**
 * Remove filter button component
 */
export interface RemoveFilterButtonProps {
  onRemove: () => void;
}

export const RemoveFilterButton: React.FC<RemoveFilterButtonProps> = ({ onRemove }) => (
  <button className={styles.deleteButton} onClick={onRemove} aria-label="Remove filter">
    ×
  </button>
);
