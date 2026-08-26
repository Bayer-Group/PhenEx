import React, { useState } from 'react';
import styles from './SingleCategoricalFilterEditor.module.css';
import { useDomains } from '../../../../../hooks/useDomains';

// Operator type matching Python CategoricalFilter
type FilterOperator = 'isin' | 'notin' | 'isnull' | 'notnull';

interface SingleCategoricalFilterEditorProps {
  onValueChange?: (value: {
    column_name: string;
    domain: string;
    allowed_values: string[];
    class_name: 'CategoricalFilter';
    status: 'empty';
    constant: string | null;
    operator: FilterOperator;
  }) => void;
  value?: {
    column_name: string;
    domain: string;
    allowed_values: string[];
    class_name: 'CategoricalFilter';
    status: string;
    id: string;
    constant: string | null;
    operator?: FilterOperator;
  };
  onDelete?: () => void;
  onIsEditing?: (isEditing: false) => void;
  createLogicalFilter?: (
    logicalOperator: 'AndFilter' | 'OrFilter',
    filter: {
      column_name: string;
      domain: string;
      allowed_values: string[];
      class_name: 'CategoricalFilter';
      status: string;
      id: string;
      constant: string | null;
      operator: FilterOperator;
    }
  ) => void;
}

// Constant options for demonstration
const CONSTANT_OPTIONS = ['one', 'two', 'three'];

// Operator options matching Python CategoricalFilter
const OPERATOR_OPTIONS: { value: FilterOperator; label: string; description: string }[] = [
  { value: 'isin', label: 'Is In', description: 'Value matches one of the allowed values' },
  { value: 'notin', label: 'Not In', description: 'Value does not match any allowed values (excludes nulls)' },
  { value: 'isnull', label: 'Is Null', description: 'Value is null/empty' },
  { value: 'notnull', label: 'Not Null', description: 'Value is not null/empty' },
];

/**
 * Component for editing a single categorical filter.
 * Allows users to either:
 * 1. Specify a column name, domain, and allowed values, OR
 * 2. Use a constant value
 * 
 * Domains are loaded dynamically based on the current database mapper configuration.
 */
export const SingleCategoricalFilterEditor: React.FC<SingleCategoricalFilterEditorProps> = ({
  onValueChange,
  value,
  onDelete,
  onIsEditing,
  createLogicalFilter,
}) => {
  // Load domains from the current mapper configuration
  const { domains } = useDomains();
  
  const [isEditing, setIsEditing] = useState(false);
  const [useConstant, setUseConstant] = useState(
    () => value?.constant !== null && value?.constant !== undefined
  );
  const [values, setValues] = useState(() => {
    if (value) {
      return { ...value, operator: value.operator || 'isin' };
    }
    return {
      column_name: '',
      domain: '',
      allowed_values: [] as string[],
      class_name: 'CategoricalFilter' as const,
      status: 'empty',
      id: Math.random().toString(36),
      constant: null,
      operator: 'isin' as FilterOperator,
    };
  });
  let newValues = { ...values };

  /**
   * Handles changes to filter field values
   */
  const handleValueChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>, field: string, value: string) => {
    event.stopPropagation();
    
    if (field === 'allowed_values') {
      newValues.allowed_values = [value];
    } else if (field === 'constant') {
      newValues.constant = value;
      newValues.allowed_values = [];
    } else if (field === 'operator') {
      newValues = { ...newValues, operator: value as FilterOperator };
      // Clear allowed_values if switching to null-checking operators
      if (value === 'isnull' || value === 'notnull') {
        newValues.allowed_values = [];
      }
    } else {
      newValues = { ...newValues, [field]: value };
    }

    // Update status based on whether using constant or regular fields
    if (useConstant) {
      newValues.status = newValues.constant ? 'complete' : 'incomplete';
    } else {
      // Null-checking operators don't need allowed_values
      const needsAllowedValues = newValues.operator === 'isin' || newValues.operator === 'notin';
      const hasRequiredValues = needsAllowedValues ? newValues.allowed_values.length > 0 : true;
      
      if (
        newValues.column_name.length > 0 &&
        hasRequiredValues &&
        newValues.domain.length > 0
      ) {
        newValues.status = 'complete';
      } else {
        newValues.status = 'incomplete';
      }
    }

    setValues(newValues);
  };

  /**
   * Toggles between constant mode and regular field mode
   */
  const handleConstantToggle = (checked: boolean) => {
    setUseConstant(checked);
    const newValues = {
      ...values,
      constant: checked ? CONSTANT_OPTIONS[0] : null,
      allowed_values: checked ? [] : values.allowed_values,
    };
    setValues(newValues);
  };

  /**
   * Finalizes editing and passes the updated values to parent
   */
  const handleDone = () => {
    if (!useConstant && newValues.allowed_values.length > 0) {
      values.allowed_values = newValues.allowed_values[0]
        .split(',')
        .map(v => v.trim())
        .filter(v => v.length > 0);
    }

    onValueChange?.(values as any);
    setIsEditing(false);
    onIsEditing?.(false as any);
  };

  /**
   * Handles filter deletion
   */
  const handleDelete = () => {
    onDelete?.();
  };

  /**
   * Renders the constant value selector
   */
  const renderConstantEditor = () => {
    return (
      <div className={styles.field}>
        <label>Constant Value:</label>
        <select
          value={values.constant || ''}
          onChange={e => handleValueChange(e, 'constant', e.target.value)}
        >
          {CONSTANT_OPTIONS.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  };

  /**
   * Activates editing mode
   */
  const startEditing = () => {
    setIsEditing(true);
    onIsEditing?.(true as any);
  };

  /**
   * Wrapper for rendering a single filter box with delete and logical operator buttons
   */
  const renderSingleFilterBox = (content: React.ReactNode) => {
    return (
      <div className={styles.fullCategoricalFilter}>
        <div className={styles.categoricalFilterContainer} onClick={() => startEditing()}>
          <button
            className={styles.deleteButton}
            onClick={e => {
              e.stopPropagation();
              handleDelete();
            }}
          >
            ×
          </button>
          <div className={styles.singleFilterBoxContent}>{content}</div>
        </div>
        {!isEditing && (
          <div className={styles.logicalButtons}>
            <button
              onClick={e => {
                e.stopPropagation();
                createLogicalFilter?.('AndFilter', values as any);
              }}
            >
              AND
            </button>
            <button
              onClick={e => {
                e.stopPropagation();
                createLogicalFilter?.('OrFilter', values as any);
              }}
            >
              OR
            </button>
          </div>
        )}
      </div>
    );
  };

  /**
   * Renders an empty filter placeholder
   */
  const renderEmptyFilter = () => {
    return renderSingleFilterBox(<span>Click to add a categorical filter</span>);
  };

  /**
   * Renders a populated categorical filter in read-only mode
   */
  const renderCategoricalFilter = () => {
    /**
     * Get display text for the operator
     */
    const getOperatorText = () => {
      const operatorMap = {
        'isin': 'is',
        'notin': 'is not',
        'isnull': 'is null',
        'notnull': 'is not null',
      };
      return operatorMap[values.operator] || 'is';
    };
    
    const isNullOperator = values.operator === 'isnull' || values.operator === 'notnull';
    
    const content = (
      <span>
        {useConstant ? (
          `Constant: ${values.constant}`
        ) : (
          <>
            <div className={styles.body}>
              <span className={styles.columnName}>{values.column_name}</span>{' '}
              <span className={styles.filler}>{getOperatorText()}</span>{' '}
              {!isNullOperator && (
                <span className={styles.allowedValues}>{values.allowed_values.join(', ')}</span>
              )}
            </div>
            <div className={styles.footer}>
              Domain: <span className={styles.domain}>{values.domain}</span>
            </div>
          </>
        )}
      </span>
    );
    return renderSingleFilterBox(content);
  };

  /**
   * Renders the component in non-editing (read-only) state
   */
  const renderNotEditingState = () => {
    if (values.status === 'empty') return renderEmptyFilter();
    return renderCategoricalFilter();
  };

  /**
   * Renders the component in editing state
   */
  const renderEditingState = () => {
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
      }
    };

    return (
      <div className={styles.editorBox} onKeyDown={handleKeyDown} tabIndex={-1}>
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

        {useConstant ? renderConstantEditor() : renderCategoricalFilterEditor()}

        <button className={styles.doneButton} onClick={handleDone}>
          Done
        </button>
      </div>
    );
  };

  /**
   * Renders the categorical filter editor form
   */
  const renderCategoricalFilterEditor = () => {
    const isNullOperator = values.operator === 'isnull' || values.operator === 'notnull';
    
    return (
      <div className={styles.fieldsBox}>
        <div className={`${styles.field} ${styles.fieldColumnName}`}>
          <label>Column Name:</label>
          <input
            type="text"
            value={values.column_name}
            onChange={e => handleValueChange(e, 'column_name', e.target.value)}
            placeholder="Enter column name"
          />
        </div>
        
        <div className={styles.field}>
          <label>Operator:</label>
          <select
            value={values.operator}
            onChange={e => handleValueChange(e, 'operator', e.target.value)}
            title={OPERATOR_OPTIONS.find(op => op.value === values.operator)?.description}
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
              value={values.allowed_values.join(', ')}
              onChange={e => handleValueChange(e, 'allowed_values', e.target.value)}
              placeholder="Enter comma-separated values"
            />
          </div>
        )}
        
        <div className={styles.field}>
          <label>Domain:</label>
          <select
            value={values.domain}
            onChange={e => handleValueChange(e, 'domain', e.target.value)}
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
    );
  };

  if (!isEditing) {
    return renderNotEditingState();
  }
  return renderEditingState();
};
