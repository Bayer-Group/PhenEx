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

const getViewportDimensions = () => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

const getGridDimensions = (gridElement: HTMLElement | null) => {
  if (!gridElement) return null;
  const rect = gridElement.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    bottom: rect.bottom,
    right: rect.right,
  };
};

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
  const calculatePosition = () => {
    const viewport = getViewportDimensions();
    const cellElement = props.eGridCell as HTMLElement;
    const gridContainer = cellElement?.closest('.ag-root') as HTMLElement;
    const gridDimensions = getGridDimensions(gridContainer);
    const cellRect = cellElement?.getBoundingClientRect();

    if (!cellRect || !gridDimensions) {
      console.warn('Could not find necessary elements for positioning');
      return { left: 0, top: 0 };
    }

    const editorWidth = 300;
    const editorHeight = 500;

    // Calculate initial position relative to cell
    let left = cellRect.left;
    let top = cellRect.top;

    // Adjust for grid scroll
    const gridScrollTop = gridContainer.scrollTop || 0;
    const gridScrollLeft = gridContainer.scrollLeft || 0;

    // Adjust position to stay within grid bounds
    // First, try to position below the cell
    if (top + editorHeight > gridDimensions.bottom) {
      // If doesn't fit below, try above
      top = Math.max(
        gridDimensions.top,
        Math.min(cellRect.top - editorHeight, viewport.height - editorHeight)
      );
    }

    // Horizontal positioning
    if (left + editorWidth > gridDimensions.right) {
      // If doesn't fit to the right, try to the left
      left = Math.max(
        gridDimensions.left,
        Math.min(cellRect.right - editorWidth, gridDimensions.right - editorWidth)
      );
    }

    // Final viewport bounds check
    left = Math.max(0, Math.min(left, viewport.width - editorWidth));
    top = Math.max(0, Math.min(top, viewport.height - editorHeight));

    return {
      left: `${left}px`,
      top: `${top}px`,
      maxHeight: `${Math.min(500, viewport.height - top)}px`,
      maxWidth: `${Math.min(300, viewport.width - left)}px`,
    };
  };

  const portalStyle = {
    position: 'absolute',
    // left: `${cellRect.left + scrollLeft}px`,
    // top: `${topPosition}px`,
    // minHeight: `${cellRect.height}px`,
    maxHeight: '500px',
    zIndex: 9999,
    ...calculatePosition(),
  };

  const renderXButton = () => {
    return <button className={`${stylesXbutton.xButton} ${styles.xButton}`}>×</button>;
  };

  return (
    <Portal>
      <div
        style={portalStyle}
        ref={containerRef}
        className={styles.container}
        onClick={e => {
          e.stopPropagation(); // Stop click from bubbling
          e.nativeEvent.stopImmediatePropagation(); // Stop other listeners
        }}
        onMouseDown={e => {
          e.stopPropagation(); // Stop mousedown from bubbling
          e.nativeEvent.stopImmediatePropagation();
        }}
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
        <PopoverHeader onClick={handleDone} title={'phenexheader'} className={styles.popoverheader}>
          <div>
            <span className={styles.topLine}>
              <span className={styles.filler}>editing</span>
              <span className={styles.actionText}>{titleText}</span>
            </span>
            <br></br>

            <span className={styles.bottomLine}>
              <span className={`${styles.filler} ${styles.bottomLabel}`}>in</span>
              <span className={`${styles.phenotypeName} ${styles.actionText}`}>
                {props.data.name}
              </span>
            </span>
          </div>
        </PopoverHeader>
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
