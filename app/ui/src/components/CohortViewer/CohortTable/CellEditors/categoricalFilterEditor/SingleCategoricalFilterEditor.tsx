import React, { useState } from 'react';
import styles from './SingleCategoricalFilterEditor.module.css';
import deleteIcon from '../../../../../assets/icons/delete.svg';

interface SingleCategoricalFilterEditorProps {
  onValueChange?: (value: {
    column_name: string;
    domain: string;
    allowed_values: string[];
    class_name: 'CategoricalFilter';
    status: 'empty';
    constant: string | null;
  }) => void;
  value?: {
    column_name: string;
    domain: string;
    allowed_values: string[];
    class_name: 'CategoricalFilter';
    status: string;
    id: string;
    constant: string | null;
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
    }
  ) => void;
}

// Mock domain options for demonstration
const MOCK_DOMAINS = ['Clinical', 'Demographics', 'Laboratory', 'Medications', 'Procedures'];
const CONSTANT_OPTIONS = ['one', 'two', 'three'];

export const SingleCategoricalFilterEditor: React.FC<SingleCategoricalFilterEditorProps> = ({
  onValueChange,
  value,
  onDelete,
  onIsEditing,
  createLogicalFilter,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [useConstant, setUseConstant] = useState(() => value?.constant !== null);
  const [values, setValues] = useState(() => {
    if (value) {
      return value;
    }
    return {
      column_name: '',
      domain: '',
      allowed_values: [] as string[],
      class_name: 'CategoricalFilter',
      status: 'empty',
      id: Math.random().toString(36),
      constant: null,
    };
  });
  let newValues = { ...values };

  const handleValueChange = (event, field: string, value: string) => {
    event.stopPropagation();
    console.log("STOPPED PROPAGATION")
    if (field === 'allowed_values') {
      newValues.allowed_values = [value];
      // .split(',')
      // .map(v => v.trim())
      // .filter(v => v.length > 0);
    } else if (field === 'constant') {
      newValues.constant = value;
      newValues.allowed_values = [];
    } else {
      newValues = { ...newValues, [field]: value };
    }

    if (useConstant) {
      newValues.status = newValues.constant ? 'complete' : 'incomplete';
    } else {
      if (
        newValues.column_name.length > 0 &&
        newValues.allowed_values.length > 0 &&
        newValues.domain.length > 0
      ) {
        newValues.status = 'complete';
      } else {
        newValues.status = 'incomplete';
      }
    }

    setValues(newValues);
  };

  const handleConstantToggle = (checked: boolean) => {
    setUseConstant(checked);
    const newValues = {
      ...values,
      constant: checked ? CONSTANT_OPTIONS[0] : null,
      allowed_values: checked ? [] : values.allowed_values,
    };
    setValues(newValues);
  };

  const handleDone = () => {
    if (!useConstant) {
      values.allowed_values = newValues.allowed_values[0]
        .split(',')
        .map(v => v.trim())
        .filter(v => v.length > 0);
    }

    onValueChange?.(values);
    setIsEditing(false);
    onIsEditing?.(false);
  };

  const handleDelete = () => {
    onDelete(values);
  };

  const renderConstantEditor = () => {
    return (
      <div className={styles.field}>
        <label>Constant Value:</label>
        <select
          value={values.constant || ''}
          onChange={e => handleValueChange('constant', e.target.value)}
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

  const startEditing = () => {
    setIsEditing(true);
    onIsEditing?.(true);
  };

  const renderSingleFilterBox = content => {
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
            ×{/* <img src={deleteIcon} alt="Delete filter" width="16" height="16" /> */}
          </button>
          <div className={styles.singleFilterBoxContent}>{content}</div>
        </div>
        {!isEditing && (
          <div className={styles.logicalButtons}>
            <button
              onClick={e => {
                e.stopPropagation();
                createLogicalFilter('AndFilter', values);
              }}
            >
              AND
            </button>
            <button
              onClick={e => {
                e.stopPropagation();
                createLogicalFilter('OrFilter', values);
              }}
            >
              OR
            </button>
          </div>
        )}
      </div>
    );
  };
  const renderEmptyFilter = () => {
    return renderSingleFilterBox(<span>Click to add a categorical filter</span>);
  };

  const renderCategoricalFilter = () => {
    // this is rendered within a categoricalFilterContainer
    const content = (
      <span>
        {useConstant ? (
          `Constant: ${values.constant}`
        ) : (
          <>
            <div className={styles.body}>
              <span className={styles.columnName}>{values.column_name}</span>{' '}
              <span className={styles.filler}>is</span>{' '}
              <span className={styles.allowedValues}>{values.allowed_values}</span>
            </div>
            <div className={styles.footer}>
              Domain :<span className={styles.domain}>{values.domain}</span>
            </div>
          </>
        )}
      </span>
    );
    return renderSingleFilterBox(content);
  };

  const renderNotEditingState = () => {
    if (values.status === 'empty') return renderEmptyFilter();
    return renderCategoricalFilter();
  };

  const renderEditingState = () => {
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

        {useConstant ? renderConstantEditor() : renderCategoricalFilterEditor()}

        <button className={styles.doneButton} onClick={handleDone}>
          Done
        </button>
      </div>
    );
  };

  const renderCategoricalFilterEditor = () => {
    return (
      <div className={styles.fieldsBox}>
        <div className={`${styles.field} ${styles.fieldColumnName}`}>
          <label>Column Name:</label>
          <input
            type="text"
            value={values.column_name}
            onChange={e =>  handleValueChange(e, 'column_name', e.target.value)}
            placeholder="Enter column name"
          />
        </div>
        <div className={styles.field}>
          <label>Allowed Values:</label>
          <textarea
            value={values.allowed_values.join(', ')}
            onChange={e => handleValueChange(e, 'allowed_values', e.target.value)}
            placeholder="Enter comma-separated values"
          />
        </div>
        <div className={styles.field}>
          <label>Domain:</label>
          <select value={values.domain} onChange={e => handleValueChange(e, 'domain', e.target.value)}>
            <option value="">Select Domain</option>
            {MOCK_DOMAINS.map(domain => (
              <option key={domain} value={domain}>
                {domain}
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
