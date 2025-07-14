import React, { useState } from 'react';
import styles from './ValueFilterEditor.module.css';
import { ValueFilter, AndFilter, Value } from './types';

interface ValueFilterEditorProps {
  value?: ValueFilter | AndFilter;
  onValueChange?: (value: ValueFilter | AndFilter | null) => void;
  data?: any;
  node?: any;
  column?: any;
  colDef?: any;
  api?: any;
}

// Constants for default values
const DEFAULT_MIN_OPERATOR = '>=';
const DEFAULT_MAX_OPERATOR = '<';
const MAX_FILTERS = 2;

/**
 * Safely converts string input to integer or null
 * Handles empty strings and invalid inputs gracefully
 */
const parseIntegerValue = (stringValue: string): number | null => {
  if (stringValue === '' || stringValue === null || stringValue === undefined) {
    return null;
  }
  const parsed = parseInt(stringValue, 10);
  return isNaN(parsed) ? null : parsed;
};

/**
 * Creates a default value filter with standard settings
 */
const createDefaultFilter = (): ValueFilter => ({
  class_name: 'ValueFilter',
  min_value: { class_name: 'Value', operator: DEFAULT_MIN_OPERATOR, value: null },
  max_value: { class_name: 'Value', operator: DEFAULT_MAX_OPERATOR, value: null },
  column_name: '',
});

/**
 * Extracts individual filters from the input value (handles both single and AND filters)
 */
const extractFilters = (value?: ValueFilter | AndFilter): ValueFilter[] => {
  if (!value || typeof value !== 'object' || !('class_name' in value)) {
    return [createDefaultFilter()];
  }

  if (value.class_name === 'AndFilter') {
    return [value.filter1, value.filter2];
  } else {
    return [value];
  }
};

/**
 * Creates a Value object or returns null when operator is 'not set'
 */
const createValueObject = (
  operator: string,
  currentValue: Value | null
): Value | null => {
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
 * Determines the appropriate output format based on filter count
 */
const formatOutput = (filters: ValueFilter[]): ValueFilter | AndFilter | null => {
  if (filters.length === 0) {
    return null;
  } else if (filters.length === 1) {
    return filters[0];
  } else if (filters.length === 2) {
    return {
      class_name: 'AndFilter',
      filter1: filters[0],
      filter2: filters[1],
    };
  }
  return null;
};

export const ValueFilterEditor: React.FC<ValueFilterEditorProps> = (props) => {
  const { value, onValueChange, data } = props;

  const [filters, setFilters] = useState<ValueFilter[]>(() => extractFilters(value));

  /**
   * Updates a specific filter and notifies parent component
   */
  const updateFilter = (index: number, updates: Partial<ValueFilter>) => {
    const newFilters = [...filters];
    newFilters[index] = {
      ...newFilters[index],
      ...updates,
      class_name: 'ValueFilter',
    };
    setFilters(newFilters);
    onValueChange?.(formatOutput(newFilters));
  };

  /**
   * Adds a new filter (limited to MAX_FILTERS)
   */
  const addFilter = () => {
    if (filters.length >= MAX_FILTERS) return;
    
    const newFilters = [...filters, createDefaultFilter()];
    setFilters(newFilters);
    onValueChange?.(formatOutput(newFilters));
  };

  /**
   * Removes a filter at the specified index
   */
  const removeFilter = (index: number) => {
    const updatedFilters = filters.filter((_, i) => i !== index);
    setFilters(updatedFilters);
    onValueChange?.(formatOutput(updatedFilters));
  };

  /**
   * Handles operator change for min/max values, setting to null when 'not set'
   */
  const handleOperatorChange = (
    index: number,
    field: 'min_value' | 'max_value',
    operator: string
  ) => {
    const currentFilter = filters[index];
    const currentValue = currentFilter[field];
    const newValue = createValueObject(operator, currentValue);
    updateFilter(index, { [field]: newValue });
  };

  /**
   * Handles value changes for min/max input fields
   */
  const handleValueChange = (
    index: number,
    field: 'min_value' | 'max_value',
    value: number | null
  ) => {
    const filter = filters[index];
    const currentField = filter[field];
    
    if (currentField && currentField.operator !== 'not set') {
      updateFilter(index, {
        [field]: {
          class_name: 'Value',
          operator: currentField.operator,
          value,
        },
      });
    }
  };

  const addColumnInput = (filter: ValueFilter, index: number) => (
    <>
      <label>Column Name:</label>
      <input
        className={styles.column_name}
        value={filter.column_name}
        onChange={e => updateFilter(index, { column_name: e.target.value })}
        placeholder="Enter column name"
      />
    </>
  );

  return (
    <div className={styles.container}>
      {filters.map((filter, index) => (
        <FilterCard
          key={index}
          filter={filter}
          index={index}
          data={data}
          onUpdate={updateFilter}
          onRemove={removeFilter}
          onOperatorChange={handleOperatorChange}
          onValueChange={handleValueChange}
        />
      ))}
      <AddFilterButton onAdd={addFilter} disabled={filters.length >= MAX_FILTERS} />
    </div>
  );
};

/**
 * Individual filter card component for better modularity
 */
interface FilterCardProps {
  filter: ValueFilter;
  index: number;
  data?: any;
  onUpdate: (index: number, updates: Partial<ValueFilter>) => void;
  onRemove: (index: number) => void;
  onOperatorChange: (index: number, field: 'min_value' | 'max_value', operator: string) => void;
  onValueChange: (index: number, field: 'min_value' | 'max_value', value: number | null) => void;
}

const FilterCard: React.FC<FilterCardProps> = ({
  filter,
  index,
  data,
  onUpdate,
  onRemove,
  onOperatorChange,
  onValueChange,
}) => {
  const isAgePhenotype = data?.class_name === 'AgePhenotype';
  const fieldLabel = isAgePhenotype ? 'Age' : 'Value';

  return (
    <div className={styles.filterRow}>
      {!isAgePhenotype && (
        <ColumnNameInput
          value={filter.column_name}
          onChange={(column_name) => onUpdate(index, { column_name })}
        />
      )}
      
      <ValueRangeSection
        label={`Min ${fieldLabel}`}
        field="min_value"
        value={filter.min_value}
        operators={['>', '>=']}
        onOperatorChange={(operator) => onOperatorChange(index, 'min_value', operator)}
        onValueChange={(value) => onValueChange(index, 'min_value', value)}
      />

      <ValueRangeSection
        label={`Max ${fieldLabel}`}
        field="max_value"
        value={filter.max_value}
        operators={['<', '<=']}
        onOperatorChange={(operator) => onOperatorChange(index, 'max_value', operator)}
        onValueChange={(value) => onValueChange(index, 'max_value', value)}
      />

      <RemoveFilterButton onRemove={() => onRemove(index)} />
    </div>
  );
};

/**
 * Column name input component
 */
interface ColumnNameInputProps {
  value: string;
  onChange: (value: string) => void;
}

const ColumnNameInput: React.FC<ColumnNameInputProps> = ({ value, onChange }) => (
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
interface ValueRangeSectionProps {
  label: string;
  field: 'min_value' | 'max_value';
  value: Value | null;
  operators: string[];
  onOperatorChange: (operator: string) => void;
  onValueChange: (value: number | null) => void;
}

const ValueRangeSection: React.FC<ValueRangeSectionProps> = ({
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
interface RemoveFilterButtonProps {
  onRemove: () => void;
}

const RemoveFilterButton: React.FC<RemoveFilterButtonProps> = ({ onRemove }) => (
  <button
    className={styles.deleteButton}
    onClick={onRemove}
    aria-label="Remove filter"
  >
    ×
  </button>
);

/**
 * Add filter button component
 */
interface AddFilterButtonProps {
  onAdd: () => void;
  disabled: boolean;
}

const AddFilterButton: React.FC<AddFilterButtonProps> = ({ onAdd, disabled }) => (
  <button 
    className={styles.addButton} 
    onClick={onAdd}
    disabled={disabled}
  >
    Click to add a value filter
  </button>
);
