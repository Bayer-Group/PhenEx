import React, { useState, useEffect } from 'react';
import styles from '../categoricalFilterEditor/SingleCategoricalFilterEditor.module.css';
import { SingleLogicalExpression } from './types';
import { CohortDataService } from '../../../CohortDataService/CohortDataService';
import { TableRow } from '../../../tableTypes';
import typeStyles from '../../../../../styles/study_types.module.css';
import { Tabs } from '../../../../../components/ButtonsAndTabs/Tabs/Tabs';

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
  const [activeTab, setActiveTab] = useState(0);
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
        // Set active tab based on whether components exist
        setActiveTab(components.length === 0 ? 1 : 0);
      } else {
        console.warn('getAllDescendants returned invalid data:', descendants);
        setComponentPhenotypes([]);
        setActiveTab(1);
      }
    } else {
      setComponentPhenotypes([]);
      setActiveTab(1);
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
  const renderItemMirror = () => {
    if (!value.phenotype_name) {
      return (
        <div className={styles.itemMirror}>
          <div className={`${styles.unit} ${colorTextClass}`}>
            <div className={styles.top}>(empty)</div>
            <div className={styles.bottom}></div>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.itemMirror}>
        <div className={`${styles.unit} ${colorTextClass}`}>
          <div className={styles.top}>{value.phenotype_name}</div>
          <div className={styles.bottom}></div>
        </div>
      </div>
    );
  };

  /**
   * Render the phenotype selection list
   */
  const renderPhenotypeList = () => {
    if (componentPhenotypes.length === 0) {
      return (
        <div className={styles.emptyMessage}>
          No component phenotypes available
        </div>
      );
    }

    return (
      <div className={styles.phenotypeList}>
        {componentPhenotypes.map(pt => (
          <div
            key={pt.id}
            className={`${styles.phenotypeItem} ${value.phenotype_id === pt.id ? styles.selected : ''}`}
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
      <div className={styles.createForm}>
        <input
          type="text"
          className={styles.nameInput}
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
          className={styles.createButton}
          onClick={handleCreateNewPhenotype}
          disabled={!newPhenotypeName.trim()}
        >
          Create
        </button>
      </div>
    );
  };

  return (
    <div className={`${styles.editorBox} ${colorBlock}`}>
      {/* Top: Tabs */}
      <Tabs
        tabs={['Select Phenotype', 'Create New Phenotype']}
        active_tab_index={activeTab}
        onTabChange={setActiveTab}
        accentColor={`var(--color_${phenotype?.effective_type || 'default'})`}
      />

      {/* Central: Content Section */}
      <div className={styles.contentSection}>
        {activeTab === 0 ? renderPhenotypeList() : renderCreateForm()}
      </div>
    </div>
  );
};
