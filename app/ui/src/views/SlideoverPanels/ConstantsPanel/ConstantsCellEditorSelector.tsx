/*
This is an almost identical clone of PhenexPhenotypeCellEditor
Duplication required because the keys are not phenotype parameters but rather the type which is a phenex class name
*/
import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback } from 'react';
import { ICellEditorParams } from '@ag-grid-community/core';
import { RelativeTimeRangeFilterCellEditor } from '../../CohortViewer/CohortTable/CellEditors/RelativeTimeRangeFilterCellEditor';
import { CategoricalFilterCellEditor } from '../../CohortViewer/CohortTable/CellEditors/CategoricalFilterCellEditor';

export interface ConstantsCellEditorSelectorProps extends ICellEditorParams {
  onValueChange?: (value: any) => void;
}

const classNameToEditorMapping: Record<string, React.ComponentType<any>> = {
  RelativeTimeRangeFilter: RelativeTimeRangeFilterCellEditor,
  CategoricalFilter: CategoricalFilterCellEditor,
  // DateFilter: TODO - create DateRangeFilterCellEditor
};

export const ConstantsCellEditorSelector = forwardRef(
  (props: ConstantsCellEditorSelectorProps, ref) => {
    const editorRef = useRef<any>(null);
    
    // Parse the value if it's a JSON string (AG Grid stores it as stringified)
    const parsedInitialValue = (() => {
      if (typeof props.value === 'string') {
        try {
          return JSON.parse(props.value);
        } catch (e) {
          console.error('Failed to parse initial value:', props.value, e);
          return props.value;
        }
      }
      return props.value;
    })();
    
    const [currentValue, setCurrentValue] = useState(parsedInitialValue);
    
    // Use ref to track current value so getValue() always gets latest without recreating the handle
    const currentValueRef = useRef(currentValue);
    useEffect(() => {
      currentValueRef.current = currentValue;
    }, [currentValue]);
    
    // Expose getValue to AG Grid - stable handle, reads from ref
    useImperativeHandle(ref, () => ({
      getValue() {
        // If child editor has getValue, use it
        if (editorRef.current?.getValue) {
          return editorRef.current.getValue();
        }
        return currentValueRef.current;
      },
      isPopup() {
        return true;
      },
    }), []); // Empty deps - handle is stable
    
    // Use ref for onValueChange to avoid it being in callback deps and causing loops
    const onValueChangeRef = useRef(props.onValueChange);
    useEffect(() => {
      onValueChangeRef.current = props.onValueChange;
    }, [props.onValueChange]);
    
    // Memoize with empty deps - reads from refs
    const handleValueChange = useCallback((newValue: any) => {
      setCurrentValue(newValue);
      onValueChangeRef.current?.(newValue);
    }, []);
    
    const constantType = props.data?.type;
    
    if (constantType && constantType in classNameToEditorMapping) {
      const Editor = classNameToEditorMapping[constantType];
      return <Editor {...props} value={currentValue} onValueChange={handleValueChange} ref={editorRef} />;
    }
    
    // Fallback: show message for unsupported types
    return (
      <div style={{ padding: '16px', color: 'var(--text-color)' }}>
        <p>No editor available for type: <strong>{constantType || '(none)'}</strong></p>
        <p style={{ fontSize: '12px', opacity: 0.7 }}>Select a type first to edit the value.</p>
      </div>
    );
  }
);

ConstantsCellEditorSelector.displayName = 'ConstantsCellEditorSelector';
