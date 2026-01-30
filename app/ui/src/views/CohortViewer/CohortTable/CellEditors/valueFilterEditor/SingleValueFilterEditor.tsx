import React from 'react';
import styles from './ValueFilterEditor.module.css';
import { ValueFilter, Value } from './types';
import { ColumnNameInput, ValueRangeSection, RemoveFilterButton } from './ValueFilterEditorComponents';

interface SingleValueFilterEditorProps {
  value: ValueFilter;
  onValueChange: (value: ValueFilter) => void;
  data?: any;
}

/**
 * Creates a Value object or returns null when operator is 'not set'
 */
const createValueObject = (operator: string, currentValue: Value | null): Value | null => {
  if (operator === 'not set') {
    return null;
  }
  return {
    class_name: 'Value',
    operator: operator as '>' | '>=' | '<' | '<=',
    value: currentValue?.value ?? null,
  };
};

/**
 * SingleValueFilterEditor - Edits a single value filter in the composer panel
 * Part of the unified complex item editing pattern
 */
export const SingleValueFilterEditor: React.FC<SingleValueFilterEditorProps> = ({
  value,
  onValueChange,
  data,
}) => {
  const isAgePhenotype = data?.class_name === 'AgePhenotype';
  const fieldLabel = isAgePhenotype ? 'Age' : 'Value';

  const updateFilter = (updates: Partial<ValueFilter>) => {
    onValueChange({
      ...value,
      ...updates,
      class_name: 'ValueFilter',
    });
  };

  const handleOperatorChange = (field: 'min_value' | 'max_value', operator: string) => {
    const currentValue = value[field];
    const newValue = createValueObject(operator, currentValue);
    updateFilter({ [field]: newValue });
  };

  const handleValueChange = (field: 'min_value' | 'max_value', newValue: number | null) => {
    const currentField = value[field];
    if (currentField && currentField.operator !== 'not set') {
      updateFilter({
        [field]: {
          class_name: 'Value',
          operator: currentField.operator,
          value: newValue,
        },
      });
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.filterRow}>
        {!isAgePhenotype && (
          <ColumnNameInput
            value={value.column_name}
            onChange={column_name => updateFilter({ column_name })}
          />
        )}

        <ValueRangeSection
          label={`Min ${fieldLabel}`}
          field="min_value"
          value={value.min_value}
          operators={['>', '>=']}
          onOperatorChange={operator => handleOperatorChange('min_value', operator)}
          onValueChange={val => handleValueChange('min_value', val)}
        />

        <ValueRangeSection
          label={`Max ${fieldLabel}`}
          field="max_value"
          value={value.max_value}
          operators={['<', '<=']}
          onOperatorChange={operator => handleOperatorChange('max_value', operator)}
          onValueChange={val => handleValueChange('max_value', val)}
        />
      </div>
    </div>
  );
};
