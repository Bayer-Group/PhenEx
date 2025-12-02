import React, { useState, useEffect } from 'react';
import styles from '../categoricalFilterEditor/SingleCategoricalFilterEditor.module.css';
import { SingleLogicalExpression } from './types';
import { CohortDataService } from '../../../CohortDataService/CohortDataService';
import { TableRow } from '../../../tableTypes';

interface SimplifiedSingleLogicalExpressionEditorProps {
  value: SingleLogicalExpression;
  onValueChange: (value: SingleLogicalExpression) => void;
  phenotype?: any;
}

/**
 * SimplifiedSingleLogicalExpressionEditor - Edits a single logical expression
 * 
 * Simplified version without Done button or logical operator buttons.
 * Reports changes immediately through onValueChange callback.
 * Designed to work within PhenexCellEditor's composer panel.
 */
export const SimplifiedSingleLogicalExpressionEditor: React.FC<SimplifiedSingleLogicalExpressionEditorProps> = ({
  value,
  onValueChange,
  phenotype,
}) => {
  const [componentPhenotypes, setComponentPhenotypes] = useState<TableRow[]>([]);
  const dataService = CohortDataService.getInstance();
  
  // Load component phenotypes when component mounts or when phenotype changes
  useEffect(() => {
    if (phenotype?.id) {
      const descendants = dataService.getAllDescendants(phenotype.id);
      // Filter to only get component phenotypes
      const components = descendants.filter(pt => pt.type === 'component');
      setComponentPhenotypes(components);
    } else {
      setComponentPhenotypes([]);
    }
  }, [phenotype, dataService]);

  /**
   * Handle phenotype selection and immediately notify parent
   */
  const handlePhenotypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    event.stopPropagation();
    const selectedPhenotype = componentPhenotypes.find(p => p.name === event.target.value);
    if (selectedPhenotype) {
      const updatedValue: SingleLogicalExpression = {
        ...value,
        phenotype_name: selectedPhenotype.name,
        phenotype_id: selectedPhenotype.id,
        status: 'filled',
      };
      onValueChange(updatedValue);
    }
  };

  return (
    <div className={styles.editorBox}>
      <div className={styles.field}>
        <label>Component Phenotype:</label>
        <select
          value={value.phenotype_name || ''}
          onChange={handlePhenotypeChange}
          className={styles.phenotypeSelect}
        >
          <option value="">Select a component phenotype...</option>
          {componentPhenotypes.map(phenotype => (
            <option key={phenotype.id} value={phenotype.name}>
              {phenotype.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
