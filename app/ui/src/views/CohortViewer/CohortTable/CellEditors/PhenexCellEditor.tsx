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

export interface PhenexCellEditorProps extends ICellEditorParams {
  value: any;
  onValueChange?: (value: any) => void;
  children?: React.ReactNode;
  autoCloseOnChange?: boolean; // If true, automatically close editor when value changes (for list-view editors)
  fieldName?: string; // Optional override for the field name used to determine which renderer to use
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
    
    // Auto-close editor for list-view editors when a value is selected
    if (props.autoCloseOnChange) {
      // Small delay to ensure the value is saved before closing
      setTimeout(() => {
        props.api.stopEditing();
      }, 0);
    }
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
    const cellWidth = cellRect.width;
    const cellHeight = cellRect.height;
    
    // Current Selection Panel dimensions (with minimum width)
    const minCurrentSelectionWidth = 300;
    const currentSelectionWidth = Math.max(cellWidth, minCurrentSelectionWidth);
    
    // Bottom section is positioned at EXACT cell coordinates
    const bottomSectionLeft = cellRect.left;
    const bottomSectionTop = cellRect.top;
    
    // Composer Panel dimensions
    const composerWidth = 350;
    const composerHeight = Math.min(600, viewport.height - 100); // Max height with padding
    
    // Position Composer Panel independently for maximum visibility
    // Must account for actual current selection width (which may be larger than cell)
    let composerLeft: number;
    let composerTop: number;
    const composerPlacementThreshold = viewport.width / 2;
    
    if (cellRect.left < composerPlacementThreshold) {
      // Cell is on left side - place composer on the right
      // Use the actual width of current selection panel (could be wider than cell due to minWidth)
      composerLeft = Math.min(
        bottomSectionLeft + currentSelectionWidth + 10, // 10px gap from current selection panel
        viewport.width - composerWidth - 10 // Ensure it fits
      );
    } else {
      // Cell is on right side - place composer on the left
      composerLeft = Math.max(
        10, // Minimum left padding
        bottomSectionLeft - composerWidth - 10 // 10px gap from current selection panel
      );
    }
    
    // Position composer vertically - try to align with cell top, but adjust for visibility
    composerTop = cellRect.top;
    
    // Ensure composer fits in viewport vertically
    if (composerTop + composerHeight > viewport.height - 10) {
      composerTop = Math.max(10, viewport.height - composerHeight - 10);
    }
    // Ensure composer doesn't go above viewport
    composerTop = Math.max(10, composerTop);
    
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

  const colorBorder = typeStyles[`${props.data.effective_type || ''}_border_color`] || ''
  const colorBlock = typeStyles[`${props.data.effective_type || ''}_color_block_dim`] || ''

  // Dictionary mapping field name to their respective renderers
  const rendererByField: Record<string, React.ComponentType<any>> = {
    'class_name': PhenotypeRenderer,
    'domain': DomainRenderer,
    'expression': LogicalExpressionRenderer,
    'value_filter': CategoricalFilterRenderer,
    'codelist': CodelistRenderer,
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
          <div className={`${styles.index} ${typeStyles[`${props.data.effective_type}_text_color`]}`}>
            {props.data.hierarchical_index}
          </div>
          <SmartBreadcrumbs 
            items={breadcrumbItems}
            classNameSmartBreadcrumbsContainer={styles.breadcrumbsContainer}
            classNameBreadcrumbItem={`${styles.breadcrumbItem} ${typeStyles[`${props.data.effective_type}_text_color`]}`}
            classNameBreadcrumbLastItem={`${styles.breadcrumbLastItem} ${typeStyles[`${props.data.effective_type}_text_color`]}`}
          />
        </>
      </div>
    );
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
      
      if (RendererByField && props.value) {
        // Use the custom renderer component for field-based rendering
        return (
          <div className={styles.cellMirrorContents}>
            <RendererByField
              value={props.value}
              effectiveType={props.data?.effective_type}
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

  const renderCurrentSelectionPanel_top = () => {
    /*
    The current selection top panel is a header displaying the title of current parameter and phenotype
    */
    return (
      <div
        className={`${styles.currentSelectionTopSection}`}
        style={{
          position: 'absolute',
          left: portalPosition.currentSelection.bottomLeft,
          top: portalPosition.currentSelection.bottomTop,
          width: portalPosition.currentSelection.width,
          minWidth: '300px',
          transform: 'translateY(-100%)',
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
        <div className={`${styles.currentSelectionInfo} ${colorBlock}`}>
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
          position: 'absolute',
          left: portalPosition.currentSelection.bottomLeft,
          top: portalPosition.currentSelection.bottomTop,
          width: portalPosition.currentSelection.width,
          minWidth: '300px',
          height: portalPosition.currentSelection.bottomHeight,
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

        <div className={`${styles.cellMirror} ${colorBlock} ${typeStyles[`${props.data.effective_type || ''}_border_color`] || ''}`}>
          {renderCellMirrorContents()}
        </div>
      </div>
    );
  }

  const renderCurrentSelectionPanel = () => {
    return (
      <div className={styles.currentSelectionContainer}>
        {renderCurrentSelectionPanel_top()}
        {renderCurrentSelectionPanel_bottom()}
      </div>
    );
  };

  const renderComposerPanel = () => {
    return (
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
        <div className={`${styles.content}`}>
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
    );

  }

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
        {renderCurrentSelectionPanel()}
        {renderComposerPanel()}
      </div>
    </DraggablePortal>
  );
});

PhenexCellEditor.displayName = 'PhenexCellEditor';
