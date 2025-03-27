import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { ICellEditorParams } from '@ag-grid-community/core';
import styles from './PhenexCellEditor.module.css';

export interface PhenexCellEditorProps extends ICellEditorParams {
  value?: any;
  onValueChange?: (value: any) => void;
}

export const PhenexCellEditor = forwardRef((props: PhenexCellEditorProps, ref) => {
  const [currentValue, setCurrentValue] = useState(() => props.value);

  useImperativeHandle(ref, () => ({
    getValue() {
      return currentValue;
    },
    isPopup() {
      return true;
    },
  }));

  const handleValueChange = (value: any) => {
    if (JSON.stringify(value) !== JSON.stringify(currentValue)) {
      setCurrentValue(value);
      props.onValueChange?.(value);
    }
  };

  const handleDone = () => {
    props.api.stopEditing();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.filler}>Edit</span>{' '}
        {props.column?.getColDef().headerName || 'Editor'}{' '}
        <span className={styles.filler}>for</span> {props.data.name}
        <button className={styles.doneButton} onClick={handleDone}>
          Done
        </button>
      </div>
      {props.children}
    </div>
  );
});

PhenexCellEditor.displayName = 'PhenexCellEditor';
