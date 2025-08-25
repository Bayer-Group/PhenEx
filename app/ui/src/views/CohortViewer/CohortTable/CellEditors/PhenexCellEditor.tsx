import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { ICellEditorParams } from '@ag-grid-community/core';
import styles from './PhenexCellEditor.module.css';
import { DraggablePortal } from '../../../../components/Portal';
// import stylesXbutton from './../../../../components/ButtonsAndTabs/XButton/XButton.module.css';
import { PopoverHeader } from '../../../../components/PopoverHeader/PopoverHeader';

export interface PhenexCellEditorProps extends ICellEditorParams {
  value: any;
  onValueChange?: (value: any) => void;
  children?: React.ReactNode;
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
  const [isDragging, setIsDragging] = useState(false);
  const [recentlyDragged, setRecentlyDragged] = useState(false);

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
    console.log('handleDone called, recentlyDragged:', recentlyDragged);
    if (recentlyDragged) {
      console.log('Preventing handleDone due to recent drag');
      return; // Don't close if we just finished dragging
    }
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

    // Adjust for grid scroll (variables declared but not used in current positioning logic)
    // const gridScrollTop = gridContainer.scrollTop || 0;
    // const gridScrollLeft = gridContainer.scrollLeft || 0;

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
      maxWidth: `${Math.min(500, viewport.width - left)}px`, // DETERMINE WIDTH PHENEXCELLEDITOR
    };
  };

  const portalPosition = calculatePosition();

  // const renderXButton = () => {
  //   return <button className={`${stylesXbutton.xButton} ${styles.xButton}`}>×</button>;
  // };
  const colorClass = `rag-${props.data.type == 'entry' ? 'dark' : props.data.type == 'inclusion' ? 'blue' : props.data.type == 'exclusion' ? 'green' : props.data.type == 'baseline' ? 'coral' : props.data.type == 'outcome' ? 'red' : ''}-outer`;
  const colorBorder = `rag-${props.data.type == 'entry' ? 'dark' : props.data.type == 'inclusion' ? 'blue' : props.data.type == 'exclusion' ? 'green' : props.data.type == 'baseline' ? 'coral' : props.data.type == 'outcome' ? 'red' : ''}-border`;

  console.log('COLOR CLASS FoR PHENCE EDIOTR', colorBorder);

  return (
    <DraggablePortal
      initialPosition={{
        left: portalPosition.left,
        top: portalPosition.top,
      }}
      dragHandleSelector="[data-drag-handle='true']"
      onPositionChange={(x, y) => console.log('Position changed to:', x, y)}
      onDragStart={() => {
        console.log('Drag started - setting isDragging to true');
        setIsDragging(true);
        setRecentlyDragged(false);
      }}
      onDragEnd={wasDragged => {
        console.log('Drag ended - wasDragged:', wasDragged);
        setIsDragging(false);
        if (wasDragged) {
          setRecentlyDragged(true);
          // Clear the flag after a short delay
          setTimeout(() => {
            console.log('Clearing recentlyDragged flag');
            setRecentlyDragged(false);
          }, 200);
        }
      }}
    >
      <div
        style={{
          maxHeight: portalPosition.maxHeight,
          maxWidth: portalPosition.maxWidth,
          zIndex: 9999,
        }}
        ref={containerRef}
        className={`${styles.container} ${colorBorder}`}
        onClick={e => {
          console.log('PhenexCellEditor onClick fired');
          e.stopPropagation(); // Stop click from bubbling
          e.nativeEvent.stopImmediatePropagation(); // Stop other listeners
        }}
        onMouseDown={e => {
          console.log('PhenexCellEditor onMouseDown fired');
          console.log('MouseDown target:', e.target);

          // Check if this is a drag handle - if so, don't stop propagation
          const target = e.target as HTMLElement;
          const isDragHandle = target.closest('[data-drag-handle="true"]');

          if (isDragHandle) {
            console.log('MouseDown on drag handle - allowing propagation');
            return; // Don't stop propagation for drag handles
          }

          console.log('MouseDown not on drag handle - stopping propagation');
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
        <PopoverHeader
          onClick={handleDone}
          title={'phenexheader'}
          className={`${styles.popoverheader} ${colorClass} ${colorBorder}`}
        >
          <div
            className={styles.popoverHeader}
            data-drag-handle="true"
            onMouseDown={e => {
              console.log('Drag handle onMouseDown fired');
              console.log('Drag handle target:', e.target);
              // Don't stop propagation here - let it bubble up to DraggablePortal
            }}
          >
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
        <div className={`${styles.content}`}>
          {React.Children.map(props.children, (child, index) =>
            React.isValidElement(child)
              ? React.cloneElement(child as React.ReactElement<any>, {
                  key: index,
                  ...props,
                  onValueChange: handleValueChange,
                })
              : child
          )}
        </div>
      </div>
    </DraggablePortal>
  );
});

PhenexCellEditor.displayName = 'PhenexCellEditor';
