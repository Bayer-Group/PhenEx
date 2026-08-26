import React, { useState } from 'react';
import styles from './SingleCategoricalFilterEditor.module.css';
import { useDomains } from '../../../../../hooks/useDomains';
import { BaseCategoricalFilter } from './types';

// Operator type matching Python CategoricalFilter
type FilterOperator = 'isin' | 'notin' | 'isnull' | 'notnull';

// Operator options matching Python CategoricalFilter
const OPERATOR_OPTIONS: { value: FilterOperator; label: string; description: string }[] = [
  { value: 'isin', label: 'Is In', description: 'Value matches one of the allowed values' },
  { value: 'notin', label: 'Not In', description: 'Value does not match any allowed values (excludes nulls)' },
  { value: 'isnull', label: 'Is Null', description: 'Value is null/empty' },
  { value: 'notnull', label: 'Not Null', description: 'Value is not null/empty' },
];

// Constant options for demonstration
const CONSTANT_OPTIONS = ['one', 'two', 'three'];

interface SingleCategoricalFilterEditorProps {
  value: BaseCategoricalFilter & { operator?: FilterOperator; constant?: string | null };
  onValueChange: (value: BaseCategoricalFilter & { operator?: FilterOperator; constant?: string | null }) => void;
}

/**
 * SimplifiedSingleCategoricalFilterEditor - Edits a single categorical filter
 * 
 * Simplified version without Done button or logical operator buttons.
 * Reports changes immediately through onValueChange callback.
 * Designed to work within PhenexCellEditor's composer panel.
 */
export const SimplifiedSingleCategoricalFilterEditor: React.FC<SingleCategoricalFilterEditorProps> = ({
  value,
  onValueChange,
}) => {
  const { domains } = useDomains();
  
  const [useConstant, setUseConstant] = useState(
    () => value?.constant !== null && value?.constant !== undefined
  );

  /**
   * Handle field changes and immediately notify parent
   */
  const handleFieldChange = (field: string, fieldValue: string) => {
    let updatedValue = { ...value };

    if (field === 'allowed_values') {
      // Parse comma-separated values
      updatedValue.allowed_values = fieldValue
        .split(',')
        .map(v => v.trim())
        .filter(v => v.length > 0);
    } else if (field === 'constant') {
      updatedValue = { ...updatedValue, constant: fieldValue, allowed_values: [] };
    } else if (field === 'operator') {
      updatedValue.operator = fieldValue as FilterOperator;
      // Clear allowed_values if switching to null-checking operators
      if (fieldValue === 'isnull' || fieldValue === 'notnull') {
        updatedValue.allowed_values = [];
      }
    } else {
      updatedValue = { ...updatedValue, [field]: fieldValue };
    }

    // Update status
    if (useConstant) {
      updatedValue.status = updatedValue.constant ? 'complete' : 'incomplete';
    } else {
      const operator = updatedValue.operator || 'isin';
      const needsAllowedValues = operator === 'isin' || operator === 'notin';
      const hasRequiredValues = needsAllowedValues ? updatedValue.allowed_values.length > 0 : true;
      
      updatedValue.status = (
        updatedValue.column_name.length > 0 &&
        hasRequiredValues &&
        updatedValue.domain.length > 0
      ) ? 'complete' : 'incomplete';
    }

    onValueChange(updatedValue);
  };

  /**
   * Toggle between constant mode and regular field mode
   */
  const handleConstantToggle = (checked: boolean) => {
    setUseConstant(checked);
    const updatedValue = {
      ...value,
      constant: checked ? CONSTANT_OPTIONS[0] : null,
      allowed_values: checked ? [] : value.allowed_values,
      status: checked ? 'complete' : 'incomplete',
    };
    onValueChange(updatedValue);
  };

  const operator = value.operator || 'isin';
  const isNullOperator = operator === 'isnull' || operator === 'notnull';

  return (
    <div className={styles.editorBox}>
      <div className={styles.checkboxField}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={useConstant}
            onChange={e => handleConstantToggle(e.target.checked)}
          />
          Use Constant
        </label>
      </div>

      {useConstant ? (
        <div className={styles.field}>
          <label>Constant Value:</label>
          <select
            value={value.constant || ''}
            onChange={e => handleFieldChange('constant', e.target.value)}
          >
            {CONSTANT_OPTIONS.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className={styles.fieldsBox}>
          <div className={`${styles.field} ${styles.fieldColumnName}`}>
            <label>Column Name:</label>
            <input
              type="text"
              value={value.column_name}
              onChange={e => handleFieldChange('column_name', e.target.value)}
              placeholder="Enter column name"
            />
          </div>
          
          <div className={styles.field}>
            <label>Operator:</label>
            <select
              value={operator}
              onChange={e => handleFieldChange('operator', e.target.value)}
              title={OPERATOR_OPTIONS.find(op => op.value === operator)?.description}
            >
              {OPERATOR_OPTIONS.map(option => (
                <option key={option.value} value={option.value} title={option.description}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          {!isNullOperator && (
            <div className={styles.field}>
              <label>Allowed Values:</label>
              <textarea
                value={value.allowed_values.join(', ')}
                onChange={e => handleFieldChange('allowed_values', e.target.value)}
                placeholder="Enter comma-separated values"
              />
            </div>
          )}
          
          <div className={styles.field}>
            <label>Domain:</label>
            <select
              value={value.domain}
              onChange={e => handleFieldChange('domain', e.target.value)}
            >
              <option value="">Select Domain</option>
              {domains.map(domain => (
                <option key={domain.name} value={domain.name}>
                  {domain.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
