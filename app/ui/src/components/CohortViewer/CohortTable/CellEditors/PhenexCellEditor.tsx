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
    setCurrentValue(value);
    props.onValueChange?.(value);
  };

  const handleDone = () => {
    props.api.stopEditing();
  };

  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.nativeEvent.stopImmediatePropagation();
      e.preventDefault();
      e.stopPropagation();

      const focusableElements = Array.from(
        e.currentTarget.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => {
        const style = window.getComputedStyle(el as Element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });

      if (focusableElements.length === 0) return;

      const currentFocusIndex = focusableElements.indexOf(document.activeElement as Element);
      const nextIndex = e.shiftKey
        ? currentFocusIndex > 0
          ? currentFocusIndex - 1
          : focusableElements.length - 1
        : currentFocusIndex < focusableElements.length - 1
          ? currentFocusIndex + 1
          : 0;

      (focusableElements[nextIndex] as HTMLElement).focus();
    }
  }, []);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const focusableElements = Array.from(
      container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => {
      const style = window.getComputedStyle(el as Element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });

    if (focusableElements.length > 0) {
      (focusableElements[0] as HTMLElement).focus();
    }
  }, []);

  const titleText = props.data?.parameter || props.column?.getColDef().headerName || 'Editor';
  return (
    <div
      ref={containerRef}
      className={styles.container}
      onKeyDown={e => {
        if (e.key === 'Tab') {
          e.nativeEvent.stopImmediatePropagation();
          e.preventDefault();
          e.stopPropagation();
          handleKeyDown(e);
        }
      }}
      onKeyDownCapture={e => {
        if (e.key === 'Tab') {
          e.nativeEvent.stopImmediatePropagation();
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      tabIndex={-1}
    >
      <div className={styles.header}>
        <span className={styles.filler}>editing</span>{' '}
        {titleText}{' '}
        <span className={styles.filler}>in</span> {props.data.name}
        <button className={styles.doneButton} onClick={handleDone}>
          Done
        </button>
      </div>
      <div className={styles.content}>
        {React.Children.map(props.children, child =>
          React.isValidElement(child)
            ? React.cloneElement(child, {
                ...props,
                onValueChange: handleValueChange
              })
            : child
        )}
      </div>
    </div>
  );
});

PhenexCellEditor.displayName = 'PhenexCellEditor';
