import React, { useState, useEffect } from 'react';
import mystyles from './SimplifiedSingleLogicalExpressionEditor.module.css';

import { SingleLogicalExpression } from './types';
import { CohortDataService } from '../../../CohortDataService/CohortDataService';
import { TableRow } from '../../../tableTypes';
import typeStyles from '../../../../../styles/study_types.module.css';
import { ButtonsBar } from '../../../../../components/ButtonsAndTabs/ButtonsBar/ButtonsBar';

interface SimplifiedSingleLogicalExpressionEditorProps {
  value: SingleLogicalExpression;
  onValueChange: (value: SingleLogicalExpression) => void;
  phenotype?: any;
  onRequestPositionAdjustment?: (offset: { x: number; y: number }) => void;
  onClose?: () => void;
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
  onClose,
}) => {
  const [componentPhenotypes, setComponentPhenotypes] = useState<TableRow[]>([]);
  const [activeView, setActiveView] = useState<'select' | 'create'>('select');
  const [newPhenotypeName, setNewPhenotypeName] = useState('');
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
        // Set active view based on whether components exist
        setActiveView(components.length === 0 ? 'create' : 'select');
      } else {
        console.warn('getAllDescendants returned invalid data:', descendants);
        setComponentPhenotypes([]);
        setActiveView('create');
      }
    } else {
      setComponentPhenotypes([]);
      setActiveView('create');
    }
  }, [phenotype, dataService]);


  /**
   * Handle phenotype selection and immediately notify parent
   */
  const handlePhenotypeSelect = (selectedPhenotype: TableRow) => {
    const updatedValue: SingleLogicalExpression = {
      ...value,
      phenotype_name: selectedPhenotype.name,
      phenotype_id: selectedPhenotype.id,
      status: 'filled',
    };
    onValueChange(updatedValue);
  };

  /**
   * Handle creating new phenotype
   */
  const handleCreateNewPhenotype = () => {
    if (newPhenotypeName.trim()) {
      // TODO: Implement actual phenotype creation logic
      // For now, just update the value with the name
      const updatedValue: SingleLogicalExpression = {
        ...value,
        phenotype_name: newPhenotypeName.trim(),
        phenotype_id: '', // Will be assigned when actually created
        status: 'filled',
      };
      onValueChange(updatedValue);
      setNewPhenotypeName('');
    }
  };

  const colorBlock = typeStyles[`${phenotype?.effective_type || ''}_color_block_dim`] || '';
  const colorTextClass = typeStyles[`${phenotype?.effective_type || ''}_text_color`] || '';
  const borderColorClass = typeStyles[`${phenotype?.effective_type || ''}_border_color`] || '';

  /**
   * Render the current selection as an item mirror
   */
 
  /**
   * Render the phenotype selection list
   */
  const renderPhenotypeList = () => {
    if (componentPhenotypes.length === 0) {
      return (
        <div className={mystyles.emptyMessage}>
          No component phenotypes available
        </div>
      );
    }

    return (
      <div className={mystyles.phenotypeList}>
        {componentPhenotypes.map(pt => (
          <div
            key={pt.id}
            className={`${mystyles.phenotypeItem} ${value.phenotype_id === pt.id ? mystyles.selected : ''}`}
            onClick={() => handlePhenotypeSelect(pt)}
          >
            {pt.name}
          </div>
        ))}
      </div>
    );
  };

  /**
   * Render the create new phenotype form
   */
  const renderCreateForm = () => {
    return (
      <div className={mystyles.createForm}>
        <input
          type="text"
          className={mystyles.nameInput}
          placeholder="Enter phenotype name..."
          value={newPhenotypeName}
          onChange={(e) => setNewPhenotypeName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCreateNewPhenotype();
            }
          }}
        />
        <button
          className={mystyles.createButton}
          onClick={handleCreateNewPhenotype}
          disabled={!newPhenotypeName.trim()}
        >
          Create
        </button>
      </div>
    );
  };

  const handleDelete = () => {
    // Clear the current selection
    const emptyValue: SingleLogicalExpression = {
      ...value,
      phenotype_name: '',
      phenotype_id: '',
      status: 'empty',
    };
    onValueChange(emptyValue);
  };

  const handleClear = () => {
    // Clear the form inputs
    setNewPhenotypeName('');
  };

  const handleClose = () => {
    onClose?.();
  };

  return (
    <div className={`${mystyles.editorBox} ${colorBlock}`}>
      
      <div className={mystyles.contentSection}>
        {activeView === 'select' ? renderPhenotypeList() : renderCreateForm()}
      </div>

      {/* Bottom: Action Buttons */}
      <ButtonsBar
        width="100%"
        buttons={['Delete', 'Clear', 'Close']}
        actions={[handleDelete, handleClear, handleClose]}
      />

    </div>
  );
};
