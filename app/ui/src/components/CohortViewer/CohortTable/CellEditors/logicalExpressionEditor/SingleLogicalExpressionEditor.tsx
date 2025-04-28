import React, { useState } from 'react';
import styles from '../categoricalFilterEditor/SingleCategoricalFilterEditor.module.css';
import { SingleLogicalExpression, FilterType } from './types';

interface SingleLogicalExpressionEditorProps {
  value: SingleLogicalExpression;
  onValueChange: (value: FilterType) => void;
  onDelete: (value: FilterType) => void;
  onIsEditing: (editing: boolean) => void;
  createLogicalFilter: (type: 'AndFilter' | 'OrFilter', filter: FilterType) => void;
}

const dummyPhenotypes = [
  { name: 'Phenotype A', id: 'pheno_a' },
  { name: 'Phenotype B', id: 'pheno_b' },
  { name: 'Phenotype C', id: 'pheno_c' },
  { name: 'Phenotype D', id: 'pheno_d' },
];

export const SingleLogicalExpressionEditor: React.FC<SingleLogicalExpressionEditorProps> = ({
  value,
  onValueChange,
  onDelete,
  onIsEditing,
  createLogicalFilter,
}) => {
const [isEditing, setIsEditing] = useState(false);
const [useConstant, setUseConstant] = useState(false);
const [values, setValues] = useState(() => {
  if (value) {
    return value;
  }
  return {
    column_name: '',
    domain: '',
    allowed_values: [],
    class_name: 'LogicalExpression',
    status: 'empty',
    id: Math.random().toString(36),
    constant: null,
  };
});


const handleValueChange = (event) => {
  event.stopPropagation();
  const selectedPhenotype = dummyPhenotypes.find(p => p.name === event.target.value);
  if (selectedPhenotype) {
    const newValues = {
      ...value,
      phenotype_name: selectedPhenotype.name,
      phenotype_id: selectedPhenotype.id,
      status: 'filled',
    };
    setValues(newValues);
    onValueChange(newValues);
  }
};


  return (
    <div className={styles.fullCategoricalFilter}>
      <div className = {styles.categoricalFilterContainer}>
      <button
          onClick={() => onDelete(value)}
          className={styles.deleteButton}
          aria-label="Delete filter"
        >
          ×
        </button>
      <select
        value={value.phenotype_name || ''}
        onChange={handleValueChange}
        className={styles.phenotypeSelect}
      >
        <option value="">Select a phenotype...</option>
        {dummyPhenotypes.map(phenotype => (
          <option key={phenotype.id} value={phenotype.name}>
            {phenotype.name}
          </option>
        ))}
      </select>

      <div className={styles.logicalButtons}>
        <button
          onClick={() => createLogicalFilter('AndFilter', value)}
          className={styles.logicalButton}
        >
          AND
        </button>
        <button
          onClick={() => createLogicalFilter('OrFilter', value)}
          className={styles.logicalButton}
        >
          OR
        </button>

        </div>
      </div>
    </div>
  );
};