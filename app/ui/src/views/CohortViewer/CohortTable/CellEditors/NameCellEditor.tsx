import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ICellEditorParams } from '@ag-grid-community/core';
import { DraggablePortal } from '../../../../components/Portal';
import styles from './NameCellEditor.module.css';

export const NameCellEditor = forwardRef<any, ICellEditorParams>((props, ref) => {
  const [value, setValue] = useState<string>(
    typeof props.value === 'string' ? props.value : ''
  );
  const valueRef = useRef(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  useImperativeHandle(ref, () => ({
    getValue() {
      return valueRef.current;
    },
    isPopup() {
      return true;
    },
    getPopupPosition() {
      return 'under';
    },
    isCancelAfterEnd() {
      return false;
    },
  }), []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    valueRef.current = e.target.value;
    setValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    if (e.key === 'Escape') {
      props.api.stopEditing(true);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      props.api.stopEditing();
    }
  };

  const cellElement = props.eGridCell as HTMLElement;
  const cellRect = cellElement?.getBoundingClientRect();
  const left = cellRect ? cellRect.left : 0;
  const top = cellRect ? cellRect.top : 0;

  return (
    <DraggablePortal
      initialPosition={{ left, top }}
      dragHandleSelector="[data-no-drag]"
      enableDragging={false}
      clampToViewport
    >
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Enter name..."
      />
    </DraggablePortal>
  );
});

NameCellEditor.displayName = 'NameCellEditor';
