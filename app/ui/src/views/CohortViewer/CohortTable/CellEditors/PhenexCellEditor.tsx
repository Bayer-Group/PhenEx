import React, { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { ICellEditorParams } from '@ag-grid-community/core';
import styles from './PhenexCellEditor.module.css';
import { DraggablePortal } from '../../../../components/Portal';
import { SimpleCustomScrollbar } from '../../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
// import stylesXbutton from './../../../../components/ButtonsAndTabs/XButton/XButton.module.css';
import { PopoverHeader } from '../../../../components/PopoverHeader/PopoverHeader';
import { Button } from '../../../../components/ButtonsAndTabs/Button/Button';
import parametersInfoRaw from '/assets/parameters_info.json?raw';
let parametersInfo = JSON.parse(parametersInfoRaw);
import typeStyles from '../../../../styles/study_types.module.css';
import ReactMarkdown from 'react-markdown';

export interface PhenexCellEditorProps extends ICellEditorParams {
  value: any;
  onValueChange?: (value: any) => void;
  children?: React.ReactNode;
}

const PHENEX_CELL_EDITOR_INFO_STATE_KEY = 'phenexCellEditorInfoOpen';

const getInfoBoxState = (): boolean => {
  try {
    const stored = localStorage.getItem(PHENEX_CELL_EDITOR_INFO_STATE_KEY);
    return stored !== null ? JSON.parse(stored) : true; // Default to open
  } catch {
    return true; // Default to open if parsing fails
  }
};

const setInfoBoxState = (isOpen: boolean): void => {
  try {
    localStorage.setItem(PHENEX_CELL_EDITOR_INFO_STATE_KEY, JSON.stringify(isOpen));
  } catch {
    // Handle localStorage errors silently
  }
};

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
  const [recentlyDragged, setRecentlyDragged] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(getInfoBoxState);

  useEffect(() => {
    // Listen for storage changes from other tabs/windows
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === PHENEX_CELL_EDITOR_INFO_STATE_KEY && e.newValue !== null) {
        try {
          setIsInfoOpen(JSON.parse(e.newValue));
        } catch {
          // Handle parsing errors silently
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

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
    console.log("Handling done")
    if (recentlyDragged) {
      return; // Don't close if we just finished dragging
    }
    props.api.stopEditing();
  };

  const toggleInfobox = () => {
    const newState = !isInfoOpen;
    setIsInfoOpen(newState);
    setInfoBoxState(newState);
  };

  const containerRef = React.useRef<HTMLDivElement>(null);
  const contentScrollableRef = React.useRef<HTMLDivElement>(null);

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

  const calculatePosition = () => {
    const viewport = getViewportDimensions();
    const cellElement = props.eGridCell as HTMLElement;
    const gridContainer = cellElement?.closest('.ag-root') as HTMLElement;
    const gridDimensions = getGridDimensions(gridContainer);
    const cellRect = cellElement?.getBoundingClientRect();

    if (!cellRect || !gridDimensions) {
      console.warn('Could not find necessary elements for positioning');
      return {
        currentSelection: { left: 0, top: 0, width: 200, height: 100 },
        composer: { left: 0, top: 0, width: 350, height: 500 },
        cell: { width: 200, height: 100 }
      };
    }

    // Cell dimensions - bottom section matches exactly
    const cellWidth = cellRect.width;
    const cellHeight = cellRect.height;
    
    // Current Selection Panel dimensions
    const topSectionHeight = 300; // Height of the section above the cell
    const currentSelectionWidth = cellWidth;
    
    // Composer Panel dimensions
    const composerWidth = 350;
    const composerHeight = Math.min(600, viewport.height - 100); // Max height with padding
    
    // Position Current Selection Panel
    // Bottom section is at exact cell position
    const currentSelectionLeft = cellRect.left;
    const currentSelectionTop = cellRect.top - topSectionHeight; // Top section extends upward
    
    // Ensure top section stays within viewport
    const adjustedCurrentSelectionTop = Math.max(20, currentSelectionTop);
    
    // Position Composer Panel (left or right of Current Selection)
    let composerLeft: number;
    const composerPlacementThreshold = viewport.width / 2;
    
    if (cellRect.left < composerPlacementThreshold) {
      // Cell is on left side - place composer on the right
      composerLeft = currentSelectionLeft + currentSelectionWidth + 10; // 10px gap
    } else {
      // Cell is on right side - place composer on the left
      composerLeft = currentSelectionLeft - composerWidth - 10; // 10px gap
    }
    
    // Ensure composer stays within viewport horizontally
    composerLeft = Math.max(10, Math.min(composerLeft, viewport.width - composerWidth - 10));
    
    // Position composer vertically to be visible
    // Try to align with the top of current selection, but adjust if needed
    let composerTop = adjustedCurrentSelectionTop;
    
    // Ensure composer fits in viewport
    if (composerTop + composerHeight > viewport.height - 20) {
      composerTop = Math.max(20, viewport.height - composerHeight - 20);
    }
    
    return {
      currentSelection: {
        left: `${currentSelectionLeft}px`,
        top: `${adjustedCurrentSelectionTop}px`,
        width: `${currentSelectionWidth}px`,
        topSectionHeight: `${topSectionHeight}px`,
        bottomSectionHeight: `${cellHeight}px`,
      },
      composer: {
        left: `${composerLeft}px`,
        top: `${composerTop}px`,
        width: `${composerWidth}px`,
        height: `${composerHeight}px`,
      },
      cell: {
        width: cellWidth,
        height: cellHeight,
      }
    };
  };

  const portalPosition = calculatePosition();

  // const renderXButton = () => {
  //   return <button className={`${stylesXbutton.xButton} ${styles.xButton}`}>×</button>;
  // };

  const colorClass = typeStyles[`${props.data.effective_type || ''}_color_block`] || ''
  const colorBorder = typeStyles[`${props.data.effective_type || ''}_border_color`] || ''



  const renderPopoverHeader = () => {
    return (
      <PopoverHeader
        onClick={handleDone}
        title={'Close or Drag'}
        className={`${styles.popoverheader} ${colorClass} ${colorBorder}`}
      >
        <div
          className={styles.popoverHeader}
          data-drag-handle="true"
          onMouseDown={() => {
            // Don't stop propagation here - let it bubble up to DraggablePortal
          }}
          onClick={() => {
            // Only handle click if we haven't recently dragged
            if (!recentlyDragged) {
              console.log("Drag handle clicked, calling handleDone");
              handleDone();
            }
          }}
        >
          <span className={styles.topLine}>
            <span className={styles.filler}>
              {props.data.hierarchical_index}
            </span>
            <span className={`${styles.phenotypeName} ${styles.actionText}`}>
              {props.data.name}
            </span>
           </span>
          <br></br>

          <span className={styles.bottomLine}>

            <span className={styles.actionText}>{titleText}</span>

          </span>
        </div>
      </PopoverHeader>
    );
  };

  const renderInfoHeader = () => {
    /*
    Render the info container with current selection and info button.
    This should maintain consistent height regardless of info state.
    */
    let parameterKey = props.column?.getColDef().field || props.data?.parameter;
    if (parameterKey == 'value'){
      parameterKey = props.data?.parameter;
    }
    const parameterInfo = parametersInfo[parameterKey as keyof typeof parametersInfo];

    const renderCurrentSelection = () => {
      if (parameterInfo && parameterInfo.showSelection == 'selection') {
        return (
          <>
            <span className={styles.currentSelectionHeader}>Current selection:</span><br></br> 
            <span className={`${styles.currentSelectionValue} ${typeStyles[`${props.data.effective_type || ''}_text_color`] || ''}`}>{props.data[parameterKey]}</span>
          </>
        );
      }
      // Return placeholder to maintain consistent height
      return <div className={styles.selectionPlaceholder}>&nbsp;</div>;
    }

    return (
      <div className={styles.infoContainer}>
        {renderCurrentSelection()}
        <Button
          title={isInfoOpen ? "Back to Editor" : "Help"}
          onClick={toggleInfobox}
          className={`${styles.infoButton} ${isInfoOpen ? styles.open : styles.closed} ${typeStyles[`${props.data.effective_type || ''}_list_item_selected`] || ''}`}
        />
      </div>
    );
  };

  const renderMainContent = () => {
    return React.Children.map(props.children, (child, index) =>
      React.isValidElement(child)
        ? React.cloneElement(child as React.ReactElement<any>, {
            key: index,
            ...props,
            onValueChange: handleValueChange,
          })
        : child
    );
  };

  const renderInfoContent = () => {
    let parameterKey = props.column?.getColDef().field || props.data?.parameter;
    if (parameterKey == 'value'){
      parameterKey = props.data?.parameter;
    }
    const parameterInfo = parametersInfo[parameterKey as keyof typeof parametersInfo];

    if (!parameterInfo) {
      return (
        <div className={styles.infoContentArea}>
          <h3>Parameter Information</h3>
          <p>No additional information available for this parameter.</p>
        </div>
      );
    }

    return (
      <div className={styles.infoContentArea}>
        {parameterInfo.description && parameterInfo.description !== "NaN" && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ marginTop: '8px', fontSize: '14px', lineHeight: '1.4' }}>
              <ReactMarkdown>{parameterInfo.description}</ReactMarkdown>
            </div>
          </div>
        )}
        {parameterInfo.showSelection == 'selection' && (
          <div style={{ marginTop: '16px' }}>
            <h4>Current selection:</h4>
            <div style={{ marginTop: '8px', fontSize: '16px', fontWeight: 'bold' }}>
              {props.data[parameterKey]}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <DraggablePortal
      initialPosition={{
        left: '0px',
        top: '0px',
      }}
      dragHandleSelector="[data-drag-handle='true']"
      onDragStart={() => {
        setRecentlyDragged(false);
      }}
      onDragEnd={wasDragged => {
        if (wasDragged) {
          setRecentlyDragged(true);
          setTimeout(() => {
            setRecentlyDragged(false);
          }, 200);
        }
      }}
    >
      <div className={styles.twoPanelWrapper}>
        {/* Current Selection Panel */}
        <div
          style={{
            position: 'absolute',
            left: portalPosition.currentSelection.left,
            top: portalPosition.currentSelection.top,
            width: portalPosition.currentSelection.width,
            zIndex: 9999,
          }}
          className={styles.currentSelectionContainer}
          onClick={e => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
          }}
          onMouseDown={e => {
            const target = e.target as HTMLElement;
            const isDragHandle = target.closest('[data-drag-handle="true"]');
            if (!isDragHandle) {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }
          }}
        >
          {/* Top Section - extends above the cell */}
          <div
            className={`${styles.currentSelectionTopSection} ${colorBorder}`}
            style={{
              height: portalPosition.currentSelection.topSectionHeight,
            }}
            data-drag-handle="true"
          >
            <div className={styles.currentSelectionInfo}>
              <span className={styles.currentSelectionLabel}>Current Selection</span>
              <span className={`${styles.currentSelectionValue} ${typeStyles[`${props.data.effective_type || ''}_text_color`] || ''}`}>
                {props.data[props.column?.getColDef().field || props.data?.parameter]}
              </span>
            </div>
          </div>
          
          {/* Bottom Section - matches calling cell exactly */}
          <div
            className={`${styles.currentSelectionBottomSection} ${colorBorder}`}
            style={{
              height: portalPosition.currentSelection.bottomSectionHeight,
            }}
            data-drag-handle="true"
          >
            <div className={styles.cellMirror}>
              <span className={styles.cellMirrorContent}>
                {props.value}
              </span>
            </div>
          </div>
        </div>

        {/* Composer Panel */}
        <div
          style={{
            position: 'absolute',
            left: portalPosition.composer.left,
            top: portalPosition.composer.top,
            width: portalPosition.composer.width,
            height: portalPosition.composer.height,
            zIndex: 9999,
          }}
          ref={containerRef}
          className={`${styles.container} ${colorBorder}`}
          onClick={e => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
          }}
          onMouseDown={e => {
            const target = e.target as HTMLElement;
            const isDragHandle = target.closest('[data-drag-handle="true"]');
            if (!isDragHandle) {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }
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
          {renderPopoverHeader()}
          <div className={`${styles.content}`}>
            {renderInfoHeader()}
            <div 
              ref={contentScrollableRef}
              className={`${styles.contentScrollable}`}
            >
              {isInfoOpen ? (
                renderInfoContent()
              ) : (
                renderMainContent()
              )}
            </div>
            
            <SimpleCustomScrollbar 
              targetRef={contentScrollableRef}
              orientation="vertical"
              marginTop={65}
              marginBottom={5}
              classNameThumb={typeStyles[`${props.data.effective_type || ''}_color_block`] || ''}
            />
          </div>
        </div>
      </div>
    </DraggablePortal>
  );
});

PhenexCellEditor.displayName = 'PhenexCellEditor';
