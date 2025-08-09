import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { ICellEditorParams } from '@ag-grid-community/core';
import styles from './PhenexCellEditor.module.css';
import { Portal } from '../../../../components/common/Portal';
import stylesXbutton from './../../../../components/XButton/XButton.module.css';
import { PopoverHeader } from '../../../../components/PopoverHeader/PopoverHeader';

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

  let titleText = props.data?.parameter || props.column?.getColDef().headerName || 'Editor';
  if (titleText == 'Name') {
    titleText = 'Settings';
  } else {
    titleText = `${titleText}`;
  }
  let cellRect = { left: 0, top: 0, width: 200, height: 100 };

  if (props.eGridCell) {
    const cellElement = props.eGridCell as HTMLElement;
    cellRect = cellElement.getBoundingClientRect();
  } else {
    console.warn('Could not find grid cell element for editor positioning');
  }
  console.log(cellRect);
  const gridContainer = props.eGridCell?.closest('.ag-root');
  const gridScrollTop = gridContainer?.scrollTop || 0;
  const gridScrollLeft = gridContainer?.scrollLeft || 0;
  const gridHeight = gridContainer?.getBoundingClientRect().height || window.innerHeight;
  const gridWidth = gridContainer?.getBoundingClientRect().width || window.innerWidth;

  // Calculate positions relative to grid scroll
  const scrollLeft = (window.pageXOffset || document.documentElement.scrollLeft) - gridScrollLeft;
  const scrollTop = (window.pageYOffset || document.documentElement.scrollTop) - gridScrollTop;

  // Calculate the editor height (500px as specified)
  const editorHeight = 500;
  const editorWidth = 300;

  // Calculate the top position
  let topPosition = cellRect.top;
  const editorBottom = topPosition + editorHeight;
  if (editorBottom > gridHeight) {
    const overflow = editorBottom - gridHeight;
    topPosition = Math.max(topPosition - overflow + 80, 0);
  }

  // Calculate the left position
  let leftPosition = cellRect.left + scrollLeft;
  if (leftPosition + editorWidth > gridWidth) {
    leftPosition = Math.min(
      leftPosition,
      gridWidth - editorWidth - 20 + gridContainer?.getBoundingClientRect().left || 0
    );
  }

  const portalStyle = {
    position: 'absolute',
    left: `${cellRect.left + scrollLeft}px`,
    top: `${topPosition}px`,
    // minHeight: `${cellRect.height}px`,
    maxHeight: '500px',
    zIndex: 9999,
  };

  const renderXButton = () => {
    return (
        <button className={`${stylesXbutton.xButton} ${styles.xButton}`}>×</button>
    )
  };




  return (
    <Portal>
      <div
        style={portalStyle}
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
        <PopoverHeader
          onClick={handleDone}
          title={'phenexheader'}
          className={styles.popoverheader}
        >
          <div>
            <span className={styles.topLine}>
              <span className={styles.filler}>editing</span>
              <span className={styles.actionText}>{titleText}</span>
            </span>
            <br></br>

            <span className={styles.bottomLine}>
              <span className={`${styles.filler} ${styles.bottomLabel}`}>in</span>
              <span className={`${styles.phenotypeName} ${styles.actionText}`}>{props.data.name}</span>
            </span>
        </div>
        </ PopoverHeader>
        <div className={styles.content}>
          {React.Children.map(props.children, child =>
            React.isValidElement(child)
              ? React.cloneElement(child, {
                  ...props,
                  onValueChange: handleValueChange,
                })
              : child
          )}
        </div>
      </div>
    </Portal>
  );
});

PhenexCellEditor.displayName = 'PhenexCellEditor';
