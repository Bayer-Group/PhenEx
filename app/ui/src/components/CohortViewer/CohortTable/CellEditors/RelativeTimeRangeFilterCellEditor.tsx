import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ICellEditorParams } from '@ag-grid-community/core';

interface RelativeTimeRangeFilterCellEditorProps extends ICellEditorParams {
  // Add any additional props specific to your editor
}

export const RelativeTimeRangeFilterCellEditor = forwardRef(
  (props: RelativeTimeRangeFilterCellEditorProps, ref) => {
    const [value1, setValue1] = useState('');
    const [value2, setValue2] = useState('');
    const refContainer = useRef<HTMLDivElement>(null);

    useEffect(() => {
      // Focus on the first input when the editor opens
      const input = refContainer.current?.querySelector('input');
      if (input) {
        input.focus();
      }
    }, []);

    useImperativeHandle(ref, () => {
      return {
        // AG Grid will call this to get the final value
        getValue() {
          return `${value1},${value2}`;
        },

        // AG Grid will call this to check if values changed
        isPopup() {
          return true;
        },
      };
    });

    return (
      <div
        ref={refContainer}
        style={{
          padding: 12,
          background: 'white',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minWidth: 200,
        }}
      >
        <input
          type="text"
          value={value1}
          onChange={e => setValue1(e.target.value)}
          style={{
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: 4,
          }}
          placeholder="Start time"
        />
        <input
          type="text"
          value={value2}
          onChange={e => setValue2(e.target.value)}
          style={{
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: 4,
          }}
          placeholder="End time"
        />
      </div>
    );
  }
);

RelativeTimeRangeFilterCellEditor.displayName = 'RelativeTimeRangeFilterCellEditor';
