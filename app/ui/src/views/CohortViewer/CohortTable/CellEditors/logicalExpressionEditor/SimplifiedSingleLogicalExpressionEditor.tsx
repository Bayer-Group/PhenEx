import React, { useState, useEffect } from 'react';
import styles from '../categoricalFilterEditor/SingleCategoricalFilterEditor.module.css';
import { SingleLogicalExpression } from './types';
import { CohortDataService } from '../../../CohortDataService/CohortDataService';
import { TableRow } from '../../../tableTypes';
import typeStyles from '../../../../../styles/study_types.module.css';

interface SimplifiedSingleLogicalExpressionEditorProps {
  value: SingleLogicalExpression;
  onValueChange: (value: SingleLogicalExpression) => void;
  phenotype?: any;
  onRequestPositionAdjustment?: (offset: { x: number; y: number }) => void;
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
  onRequestPositionAdjustment,
}) => {
  const [componentPhenotypes, setComponentPhenotypes] = useState<TableRow[]>([]);
  const dataService = CohortDataService.getInstance();
  const selectRef = React.useRef<HTMLSelectElement>(null);
  
  // Load component phenotypes when component mounts or when phenotype changes
  useEffect(() => {
    if (phenotype?.id) {
      const descendants = dataService.getAllDescendants(phenotype.id);
      // Filter to only get component phenotypes (check if descendants is valid first)
      if (descendants && Array.isArray(descendants)) {
        const components = descendants.filter(pt => pt.type === 'component');
        setComponentPhenotypes(components);
      } else {
        console.warn('getAllDescendants returned invalid data:', descendants);
        setComponentPhenotypes([]);
      }
    } else {
      setComponentPhenotypes([]);
    }
  }, [phenotype, dataService]);

  // After rendering, adjust position so the first dropdown's top-left aligns with clicked item position
  useEffect(() => {
    if (selectRef.current && onRequestPositionAdjustment) {
      // Small delay to ensure layout is complete
      requestAnimationFrame(() => {
        if (!selectRef.current) return;
        
        // Get the select element's position in viewport
        const selectRect = selectRef.current.getBoundingClientRect();
        
        // Find the composer panel container
        const composerPanel = selectRef.current.closest('[class*="container"]');
        
        if (composerPanel) {
          const composerRect = composerPanel.getBoundingClientRect();
          
          // Calculate how far the select is from the composer's top-left corner
          const offsetX = selectRect.left - composerRect.left + 10;
          const offsetY = selectRect.top - composerRect.top + 10;

          // Request negative offset to shift composer UP and LEFT
          // so select's top-left appears at the clicked position
          onRequestPositionAdjustment({ x: -offsetX, y: -offsetY });
        }
      });
    }
  }, [value]); // Re-run when value changes (new item selected)

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

  const colorBlock = typeStyles[`${phenotype?.effective_type || ''}_color_block_dim`] || '';

  return (
    <div className={`${styles.editorBox} ${colorBlock}`}>
      <div className={styles.field}>
        <label data-drag-handle="true" style={{ cursor: 'grab' }}>Component Phenotype:</label>
        <select
          ref={selectRef}
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
