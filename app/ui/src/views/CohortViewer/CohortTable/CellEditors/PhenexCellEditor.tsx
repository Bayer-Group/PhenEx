import React, { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { ICellEditorParams } from '@ag-grid-community/core';
import styles from './PhenexCellEditor.module.css';
import { DraggablePortal } from '../../../../components/Portal';
import { SimpleCustomScrollbar } from '../../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
// import stylesXbutton from './../../../../components/ButtonsAndTabs/XButton/XButton.module.css';
import { Button } from '../../../../components/ButtonsAndTabs/Button/Button';
import { SmartBreadcrumbs } from '../../../../components/SmartBreadcrumbs';
import parametersInfoRaw from '/assets/parameters_info.json?raw';
let parametersInfo = JSON.parse(parametersInfoRaw);
import typeStyles from '../../../../styles/study_types.module.css';
import ReactMarkdown from 'react-markdown';
import { LogicalExpressionRenderer } from '../CellRenderers/actualRendering/LogicalExpressionRenderer';
import { PhenotypeRenderer } from '../CellRenderers/actualRendering/PhenotypeRenderer';
import { DomainRenderer } from '../CellRenderers/actualRendering/DomainRenderer';
import { CodelistRenderer } from '../CellRenderers/actualRendering/CodelistRenderer';
import { CategoricalFilterRenderer } from '../CellRenderers/actualRendering/CategoricalFilterRenderer';
import { RelativeTimeRangeRenderer } from '../CellRenderers/actualRendering/RelativeTimeRangeRenderer';
import { TypeRenderer } from '../CellRenderers/actualRendering/TypeRenderer';
import { ValueFilterRenderer } from '../CellRenderers/actualRendering/ValueFilterRenderer';

export interface PhenexCellEditorProps extends ICellEditorParams {
  value: any;
  onValueChange?: (value: any) => void;
  children?: React.ReactNode;
  autoCloseOnChange?: boolean; // If true, automatically close editor when value changes (for list-view editors)
  fieldName?: string; // Optional override for the field name used to determine which renderer to use
  showComposerPanel?: boolean; // If false, hide composer panel (for complex item editors before selection)
  showAddButton?: boolean; // If true, show a '+' button to add new items (for complex item editors)
  onAddItem?: () => void; // Callback when add button is clicked
  onItemSelect?: (item: any, index?: number, position?: { x: number; y: number }) => void; // Callback when a complex item is selected for editing
  onEditingDone?: () => void; // Callback when complex item editing is complete (for Done button)
  selectedItemIndex?: number; // Index of the currently selected item in a complex item array (for visual highlighting)
  rendererProps?: Record<string, any>; // Additional props to pass to the renderer (e.g., onOperatorClick for logical filters)
  onRequestPositionAdjustment?: (offset: { x: number; y: number }) => void; // Callback for children to adjust composer position
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
  const [showComposer, setShowComposer] = useState(() => props.showComposerPanel !== false);
  const [clickedItemPosition, setClickedItemPosition] = useState<{ x: number; y: number } | null>(null);

  // Update currentValue when props.value changes (for complex item editors managing arrays)
  useEffect(() => {
    console.log('PhenexCellEditor: props.value changed to:', props.value);
    setCurrentValue(props.value);
  }, [props.value]);

  // Update showComposer when prop changes
  useEffect(() => {
    if (props.showComposerPanel !== undefined) {
      setShowComposer(props.showComposerPanel);
    }
  }, [props.showComposerPanel]);

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

  // Store currentValue in a ref so getValue() always gets the latest without recreating the handle
  const currentValueRef = React.useRef(currentValue);
  React.useEffect(() => {
    currentValueRef.current = currentValue;
  }, [currentValue]);

  useImperativeHandle(ref, () => {
    console.log('PhenexCellEditor: Setting up imperative handle');
    return {
      getValue() {
        console.log('=== PhenexCellEditor.getValue() called ===');
        console.log('Returning currentValueRef.current:', currentValueRef.current);
        return currentValueRef.current;
      },
      isPopup() {
        console.log('PhenexCellEditor: isPopup() called');
        return true;
      },
      isCancelAfterEnd() {
        console.log('PhenexCellEditor: isCancelAfterEnd() called');
        return false;
      },
    };
  }, []); // Empty deps - handle is stable, getValue reads from ref

  const handleDone = () => {
    console.log("=== Handling done - closing editor ===");
    console.log("Current value at close:", currentValueRef.current);
    if (recentlyDragged) {
      console.log("Recently dragged, not closing");
      return; // Don't close if we just finished dragging
    }
    
    console.log("Calling stopEditing() to close editor");
    props.api.stopEditing(); // AG Grid will call getValue() which returns currentValueRef.current
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
        currentSelection: { 
          bottomLeft: 0, 
          bottomTop: 0, 
          width: 200, 
          bottomHeight: 100 
        },
        composer: { left: 0, top: 0, width: 350, height: 500 },
        cell: { width: 200, height: 100 }
      };
    }

    // Cell dimensions - bottom section matches exactly
    const offsetX = 5;
    const offsetY = 10;
    const cellWidth = cellRect.width;
    const cellHeight = cellRect.height;
    
    // Current Selection Panel dimensions (with minimum width)
    const minCurrentSelectionWidth = 300;
    const currentSelectionWidth = Math.max(cellWidth, minCurrentSelectionWidth) +2*offsetX;
    
    // Bottom section is positioned at EXACT cell coordinates
    const bottomSectionLeft = cellRect.left - offsetX;
    const bottomSectionTop = cellRect.top - offsetY;
    
    // Composer Panel dimensions
    const composerWidth = 250;
    const composerMaxHeight = viewport.height - 100; // Max height with padding
    
    // Position Composer Panel - use clicked item position if available, otherwise use default logic
    let composerLeft: number;
    let composerTop: number;
    
    if (clickedItemPosition) {
      composerLeft = clickedItemPosition.x;
      composerTop = clickedItemPosition.y;
      
      // Shift up only if it would be cut off (estimate 500px height)
      if (composerTop + 500 > viewport.height) {
        composerTop = viewport.height - 500;
      }
      
      composerLeft = Math.max(10, Math.min(composerLeft, viewport.width - composerWidth - 10));
      composerTop = Math.max(10, composerTop);
    } else {
      // Default positioning logic when no item has been clicked
      const composerPlacementThreshold = viewport.width / 2;
      
      if (cellWidth > 350) {
        // If cell is wide, overlap at 350px from left edge
        composerLeft = bottomSectionLeft + 350;
      } else if (cellRect.left < composerPlacementThreshold) {
        // Cell is narrow and on left side - place composer on the right
        composerLeft = Math.min(
          bottomSectionLeft + currentSelectionWidth + 10,
          viewport.width - composerWidth - 10
        );
      } else {
        // Cell is narrow and on right side - place composer on the left
        composerLeft = Math.max(
          10,
          bottomSectionLeft - composerWidth - 10
        );
      }
      
      composerTop = cellRect.top;
      // Shift up only if it would be cut off (estimate 500px height)
      if (composerTop + 500 > viewport.height) {
        composerTop = viewport.height - 500;
      }
      composerTop = Math.max(10, composerTop);
    }
    
    return {
      currentSelection: {
        bottomLeft: `${bottomSectionLeft}px`,
        bottomTop: `${bottomSectionTop}px`,
        width: `${cellWidth}px`,
        bottomHeight: `${cellHeight}px`,
      },
      composer: {
        left: `${composerLeft}px`,
        top: `${composerTop}px`,
        width: `${composerWidth}px`,
        maxHeight: `${composerMaxHeight}px`,
      },
      cell: {
        width: cellWidth,
        height: cellHeight,
      }
    };
  };

  const portalPosition = React.useMemo(() => {
    return calculatePosition();
  }, [clickedItemPosition, props.eGridCell]); // Recalculate when clicked position changes

  // const renderXButton = () => {
  //   return <button className={`${stylesXbutton.xButton} ${styles.xButton}`}>×</button>;
  // };

  const colorBorder = typeStyles[`${props.data.effective_type || ''}_border_color`] || ''
  const colorBlock = typeStyles[`${props.data.effective_type || ''}_color_block_dim`] || ''

  // Dictionary mapping field name to their respective renderers
  const rendererByField: Record<string, React.ComponentType<any>> = {
    'class_name': PhenotypeRenderer,
    'domain': DomainRenderer,
    'expression': LogicalExpressionRenderer,
    'value_filter': ValueFilterRenderer,
    'categorical_filter': CategoricalFilterRenderer,
    'codelist': CodelistRenderer,
    'relative_time_range': RelativeTimeRangeRenderer,
    'relative_time_range_filter': RelativeTimeRangeRenderer, // Support both field names
    'type': TypeRenderer,
    // Add more field-based renderers here as needed
  };

  const renderTitle = () => {
    // Build breadcrumb items for the phenotype
    const breadcrumbItems = [
      {
        displayName: props.data.name || 'Unnamed Phenotype',
        onClick: () => {},
      },
      {
        displayName: titleText,
        onClick: () => {},
      },
    ];

    return (
      <div
        className={styles.threeLineTitle}
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
        <>
          <div className={`${styles.index} `}>
            {props.data.hierarchical_index}
          </div>
          <SmartBreadcrumbs 
            items={breadcrumbItems}
            classNameSmartBreadcrumbsContainer={styles.breadcrumbsContainer}
            classNameBreadcrumbItem={`${styles.breadcrumbItem} `}
            classNameBreadcrumbLastItem={`${styles.breadcrumbLastItem} `}
          />
        </>
      </div>
    );
  };

  // Internal handler that captures click position and calls parent's onItemSelect
  const handleItemClick = (item: any, index?: number, event?: React.MouseEvent) => {
    console.log('=== handleItemClick called ===');
    console.log('item:', item);
    console.log('index:', index);
    console.log('event:', event);
    
    if (event) {
      // Use the actual target element that was clicked
      const clickedElement = event.currentTarget as HTMLElement;
      const rect = clickedElement.getBoundingClientRect();
      const position = { x: rect.left, y: rect.top };
      
      console.log('handleItemClick - clicked element:', clickedElement);
      console.log('handleItemClick - rect:', rect);
      console.log('handleItemClick - position:', position);
      
      setClickedItemPosition(position);
      setShowComposer(true);
      props.onItemSelect?.(item, index, position);
    } else {
      console.log('handleItemClick - NO EVENT provided, using default position');
      setShowComposer(true);
      props.onItemSelect?.(item, index);
    }
  };

  // Handler for children to adjust composer position (e.g., to align a dropdown with clicked item)
  const handlePositionAdjustment = (offset: { x: number; y: number }) => {
    if (clickedItemPosition) {
      setClickedItemPosition({
        x: clickedItemPosition.x + offset.x,
        y: clickedItemPosition.y + offset.y,
      });
    }
  };

  const renderCellMirrorContents = () => {
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
      // Check if we have a custom renderer for this field
      // Use the explicit fieldName prop if provided, otherwise fallback to column field
      const fieldName = props.fieldName || props.column?.getColDef().field;
      const RendererByField = fieldName ? rendererByField[fieldName] : null;
      
      if (RendererByField) {
        // Use the custom renderer component for field-based rendering
        // Always render, even if value is empty (for complex item editors)
        const selectedClassName = typeStyles[`${props.data.effective_type || ''}_color_block`] || '';
        
        return (
          <div className={styles.cellMirrorContents}>
            <RendererByField
              value={props.value}
              data={props.data}
              onItemClick={handleItemClick}
              selectedIndex={props.selectedItemIndex}
              selectedClassName={selectedClassName}
              {...(props.rendererProps || {})}
            />
          </div>
        );
      }
      
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
      // <div className={styles.infoContainer}>
        renderCurrentSelection()
      //   <Button
      //     title={isInfoOpen ? "Back to Editor" : "Help"}
      //     onClick={toggleInfobox}
      //     className={`${styles.infoButton} ${isInfoOpen ? styles.open : styles.closed} ${typeStyles[`${props.data.effective_type || ''}_list_item_selected`] || ''}`}
      //   />
      // </div>
    );
  };

  // Callback for children to update the current value
  // Used by list-view editors to update value and trigger auto-close
  const handleValueChange = (value: any) => {
    console.log('PhenexCellEditor.handleValueChange called with:', value);
    setCurrentValue(value);
    console.log('Set currentValue to:', value);
    
    // Notify parent if callback provided
    props.onValueChange?.(value);
    console.log('Called props.onValueChange with:', value);
    
    // Auto-close editor for list-view editors when a value is selected
    if (props.autoCloseOnChange) {
      // Small delay to ensure the value is saved before closing
      setTimeout(() => {
        props.api.stopEditing();
      }, 0);
    }
  };

  const renderMainContent = () => {
    // Don't spread all props to avoid passing AG Grid props to DOM elements
    // For list-view editors with autoCloseOnChange, ALWAYS inject handleValueChange
    // For complex item editors, they manage their own onValueChange
    return React.Children.map(props.children, (child, index) => {
      if (React.isValidElement(child)) {
        console.log('PhenexCellEditor.renderMainContent: autoCloseOnChange?', props.autoCloseOnChange);
        
        return React.cloneElement(child as React.ReactElement<any>, {
          key: index,
          // If autoCloseOnChange is true, ALWAYS override with handleValueChange
          // Otherwise, only pass if child doesn't have one
          ...(props.autoCloseOnChange 
            ? { onValueChange: handleValueChange }
            : ((child.props as any).onValueChange ? {} : { onValueChange: handleValueChange })
          ),
          // Pass position adjustment callback to all children
          onRequestPositionAdjustment: handlePositionAdjustment,
        });
      }
      return child;
    });
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

  const renderCurrentSelectionPanel_top = () => {
    /*
    The current selection top panel is a header displaying the title of current parameter and phenotype
    */
    return (
      <div
        className={`${styles.currentSelectionTopSection}`}
        style={{
          position: 'absolute',
          left: 0,
          bottom: '100%',
          width: '100%',
          zIndex: 9998,
        }}
        data-drag-handle="true"
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
        <div className={`${styles.currentSelectionInfo}`}>
          {renderTitle()}
        </div>
      </div>
    );
  }

  const renderCurrentSelectionPanel_bottom = () => {
    /*
    The current selection bottom panel mirrors content of the calling cell i.e. it displays the current selection
    */
    return (
      <div
        className={`${styles.currentSelectionBottomSection}`}
        style={{
          position: 'relative',
          width: '100%',
          minWidth: '300px',
          minHeight: portalPosition.currentSelection.bottomHeight,
          zIndex: 9999,
        }}
        data-drag-handle="true"
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
{/* ${typeStyles[`${props.data.effective_type || ''}_border_color`] || ''} */}
        <div className={`${styles.cellMirror} ${colorBlock} ${typeStyles[`${props.data.effective_type || ''}_border_color`] || ''}`}>
          {renderCellMirrorContents()}
          {props.showAddButton && (
            <button
              className={`${styles.addButton} ${typeStyles[`${props.data.effective_type || ''}_border_color`] || ''}`}
              onClick={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                setShowComposer(true);
                props.onAddItem?.();
              }}
              title="Add new item"
            >
              +
            </button>
          )}
        </div>
      </div>
    );
  }

  const renderCurrentSelectionPanel = () => {
    return (
      <div 
        className={styles.currentSelectionContainer}
        style={{
          position: 'absolute',
          left: portalPosition.currentSelection.bottomLeft,
          top: portalPosition.currentSelection.bottomTop,
          minWidth: portalPosition.currentSelection.width,
        }}
      >
        {renderCurrentSelectionPanel_top()}
        {renderCurrentSelectionPanel_bottom()}
        <div className={styles.blocker}></div>
      </div>
    );
  };

  const renderComposerPanel = () => {
    return (
      <DraggablePortal
        initialPosition={{
          left: portalPosition.composer.left,
          top: portalPosition.composer.top,
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
        <div
          style={{
            width: portalPosition.composer.width,
            maxHeight: portalPosition.composer.maxHeight,
            zIndex: 100000,
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
          <div className={`${styles.content}`}>
            {/* Drag handle bar at the top */}
            <div 
              className={styles.composerDragHandle}
              data-drag-handle="true"
            >
            </div>
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
            
            {props.onEditingDone && showComposer && (
              <div className={styles.doneButtonContainer}>
                <button 
                  className={`${styles.doneButton} ${typeStyles[`${props.data.effective_type || ''}_color_block`] || ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                    props.onEditingDone?.();
                  }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      </DraggablePortal>
    );

  }

  return (
    <>
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
        {renderCurrentSelectionPanel()}
      </DraggablePortal>
      {showComposer && renderComposerPanel()}
    </>
  );
});

PhenexCellEditor.displayName = 'PhenexCellEditor';
