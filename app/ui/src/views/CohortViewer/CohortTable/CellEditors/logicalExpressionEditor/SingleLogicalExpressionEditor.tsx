import React, { useState, useEffect } from 'react';
import styles from '../categoricalFilterEditor/SingleCategoricalFilterEditor.module.css';
import { SingleLogicalExpression, FilterType } from './types';
import { CohortDataService } from '../../../CohortDataService/CohortDataService';
import { TableRow } from '../../../tableTypes';

interface SingleLogicalExpressionEditorProps {
  value: SingleLogicalExpression;
  onValueChange: (value: FilterType) => void;
  onDelete: (value: FilterType) => void;
  onIsEditing: (editing: boolean) => void;
  createLogicalFilter: (type: 'AndFilter' | 'OrFilter', filter: FilterType) => void;
  data?: {
    id?: string;
    type?: string;
    name?: string;
  };
}

export const SingleLogicalExpressionEditor: React.FC<SingleLogicalExpressionEditorProps> = ({
  value,
  onValueChange,
  onDelete,
  createLogicalFilter,
  data,
}) => {
  const [componentPhenotypes, setComponentPhenotypes] = useState<TableRow[]>([]);
  const dataService = CohortDataService.getInstance();
  
  // Load component phenotypes when component mounts or when data.id changes
  useEffect(() => {
    if (data?.id) {
      const descendants = dataService.getAllDescendants(data.id);
      // Filter to only get component phenotypes
      const components = descendants.filter(phenotype => phenotype.type === 'component');
      setComponentPhenotypes(components);
    } else {
      setComponentPhenotypes([]);
    }
  }, [data?.id, dataService]);

  const handleValueChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    event.stopPropagation();
    const selectedPhenotype = componentPhenotypes.find(p => p.name === event.target.value);
    if (selectedPhenotype) {
      const newValues: SingleLogicalExpression = {
        ...value,
        phenotype_name: selectedPhenotype.name,
        phenotype_id: selectedPhenotype.id,
        status: 'filled' as const,
      };
      onValueChange(newValues);
    }
  };

  return (
    <div className={styles.fullCategoricalFilter}>
      <div className={styles.categoricalFilterContainer}>
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
          <option value="">Select a component phenotype...</option>
          {componentPhenotypes.map(phenotype => (
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
