import React from 'react';
import styles from '../CodelistCellEditor.module.css';

interface MedConBCodelistEditorProps {
  value?: any;
  onValueChange?: (value: any) => void;
}

export const MedConBCodelistEditor: React.FC<MedConBCodelistEditorProps> = () => {
  return (
    <div className={styles.tabContent}>
      <div className={styles.optionsList}>
        <div className={styles.noResults}>MedConB options coming soon</div>
      </div>
    </div>
  );
};