import React, { forwardRef, useRef, useEffect, useState, useImperativeHandle } from 'react';
import { AgGridReact, AgGridReactProps } from '@ag-grid-community/react';
import { AGGridCustomScrollbar } from '../CustomScrollbar/AGGridCustomScrollbar';
import styles from './AgGridWithCustomScrollbars.module.css';

export interface AgGridWithCustomScrollbarsProps extends AgGridReactProps {
  // Additional props for customizing scrollbars
  scrollbarConfig?: {
    vertical?: {
      enabled?: boolean;
      marginTop?: number;
      marginBottom?: number;
      marginToEnd?: number; // marginRight for vertical scrollbar
      classNameThumb?: string;
      classNameTrack?: string;
    };
    horizontal?: {
      enabled?: boolean;
      marginLeft?: number;
      marginRight?: number;
      marginToEnd?: number; // marginBottom for horizontal scrollbar
      classNameThumb?: string;
      classNameTrack?: string;
      thick?: boolean; // Enable thick scrollbar mode
    };
  };
  hideScrollbars?: boolean; // External control to hide all scrollbars
  hideVerticalScrollbar?: boolean; // External control to hide only vertical scrollbar
  hideHorizontalScrollbar?: boolean; // External control to hide only horizontal scrollbar
}

export const AgGridWithCustomScrollbars = forwardRef<any, AgGridWithCustomScrollbarsProps>(
  ({ scrollbarConfig, hideScrollbars = false, hideVerticalScrollbar = false, hideHorizontalScrollbar = false, className, ...agGridProps }, ref) => {
    const gridContainerRef = useRef<HTMLDivElement>(null);
    const agGridRef = useRef<any>(null);
    const [isPanDragging, setIsPanDragging] = useState(false);
    const [panDragStart, setPanDragStart] = useState({ 
      x: 0, 
      y: 0, 
      scrollTop: 0, 
      scrollLeft: 0 
    });

    // Default scrollbar settings
    const verticalConfig = {
      enabled: true,
      marginTop: 65, // Space for header
      marginBottom: 30,
      marginToEnd: 10, // Default marginRight for vertical scrollbar
      classNameThumb: '',
      classNameTrack: '',
      ...scrollbarConfig?.vertical
    };

    const horizontalConfig = {
      enabled: true,
      marginLeft: 10,
      marginRight: 10, // Space for vertical scrollbar area
      marginToEnd: 30, // Default marginBottom for horizontal scrollbar
      classNameThumb: '',
      classNameTrack: '',
      thick: true,
      ...scrollbarConfig?.horizontal
    };

    // Get the scrollable element from AG Grid
    const getScrollableElement = () => {
      const target = gridContainerRef.current;
      if (!target) return null;
      
      // Try to find the main viewport that handles both vertical and horizontal scrolling
      const viewport = target.querySelector('.ag-center-cols-viewport') ||
                      target.querySelector('.ag-body-viewport') ||
                      target.querySelector('.ag-root-wrapper');
      
      return viewport as HTMLElement;
    };

    // Expose scroll control methods to parent components
    useImperativeHandle(ref, () => ({
      // Pass through AG Grid API with getters to ensure latest values
      get api() {
        return agGridRef.current?.api;
      },
      get columnApi() {
        return agGridRef.current?.columnApi;
      },
      get eGridDiv() {
        return gridContainerRef.current;
      },
      
      // Scroll by column (left/right)
      scrollByColumn: (direction: 'left' | 'right') => {
        const viewport = getScrollableElement();
        const api = agGridRef.current?.api;
        
        if (!viewport || !api) return;
        
        // Get all displayed columns and filter out pinned columns
        const allColumns = api.getAllDisplayedColumns();
        if (!allColumns || allColumns.length === 0) return;
        
        // Filter to only unpinned (scrollable) columns
        const columns = allColumns.filter(col => !col.getPinned());
        if (columns.length === 0) return;
        
        // Build array of column positions (cumulative widths)
        const columnPositions: number[] = [];
        let cumulativeWidth = 0;
        
        columns.forEach((col) => {
          columnPositions.push(cumulativeWidth);
          cumulativeWidth += col.getActualWidth();
        });
        
        const currentScroll = viewport.scrollLeft;
        
        // Find the leftmost visible column (the one at or just past currentScroll)
        let targetColumnIndex = 0;
        for (let i = 0; i < columnPositions.length; i++) {
          if (columnPositions[i] >= currentScroll) {
            targetColumnIndex = i;
            break;
          }
          if (i === columnPositions.length - 1) {
            targetColumnIndex = i;
          } else if (columnPositions[i] < currentScroll && columnPositions[i + 1] > currentScroll) {
            targetColumnIndex = i + 1;
            break;
          }
        }
        
        // Calculate target scroll position
        let newScroll;
        if (direction === 'left') {
          // Scroll to previous column
          const prevIndex = Math.max(0, targetColumnIndex - 1);
          newScroll = columnPositions[prevIndex];
        } else {
          // Scroll to next column
          const nextIndex = Math.min(columns.length - 1, targetColumnIndex + 1);
          newScroll = columnPositions[nextIndex];
        }
        
        const maxScroll = viewport.scrollWidth - viewport.clientWidth;
        newScroll = Math.max(0, Math.min(maxScroll, newScroll));
        
        console.log('Current column index:', targetColumnIndex, 'New scroll:', newScroll);
        
        // Direct scroll assignment
        viewport.scrollLeft = newScroll;
      },
      
      // Scroll to percentage (0-100)
      scrollToPercentage: (percentage: number) => {
        const viewport = getScrollableElement();
        if (!viewport) return;
        
        const maxScroll = viewport.scrollWidth - viewport.clientWidth;
        viewport.scrollLeft = (percentage / 100) * maxScroll;
      },
      
      // Get current scroll percentage
      getScrollPercentage: () => {
        const viewport = getScrollableElement();
        if (!viewport) return 0;
        
        const maxScroll = viewport.scrollWidth - viewport.clientWidth;
        if (maxScroll === 0) return 0;
        
        return (viewport.scrollLeft / maxScroll) * 100;
      }
    }), []);

    // Pan drag handlers for the entire viewport
    const handlePanMouseDown = (e: React.MouseEvent) => {
      // Only handle left mouse button
      if (e.button !== 0) return;
      
      // Don't interfere with existing drag operations or interactive elements
      const target = e.target as HTMLElement;
      
      // Skip if clicking on interactive elements or if they have their own drag handlers
      if (target.closest('button, input, select, textarea, [draggable], [role="button"], .ag-header-cell, .ag-row-drag, .ag-selection-checkbox, .ag-checkbox, .ag-group-expanded, .ag-group-contracted') ||
          target.hasAttribute('draggable') ||
          target.style.cursor === 'grab' ||
          target.style.cursor === 'grabbing' ||
          target.closest('.ag-header')) {
        return;
      }

      const scrollableElement = getScrollableElement();
      if (!scrollableElement) return;

      e.preventDefault();
      setIsPanDragging(true);
      setPanDragStart({
        x: e.clientX,
        y: e.clientY,
        scrollTop: scrollableElement.scrollTop,
        scrollLeft: scrollableElement.scrollLeft
      });
    };

    // Debug effect to check scrollbar hiding
    useEffect(() => {
      // Initial setup for hiding AG Grid scrollbars
    }, [verticalConfig.enabled, horizontalConfig.enabled]);

    // Handle pan dragging
    useEffect(() => {
      if (!isPanDragging) return;

      const handleMouseMove = (e: MouseEvent) => {
        const scrollableElement = getScrollableElement();
        if (!scrollableElement) return;

        // Calculate delta movement
        const deltaX = e.clientX - panDragStart.x;
        const deltaY = e.clientY - panDragStart.y;
        
        // Invert the delta for natural pan behavior (drag right to scroll left)
        const newScrollLeft = Math.max(0, Math.min(
          scrollableElement.scrollWidth - scrollableElement.clientWidth,
          panDragStart.scrollLeft - deltaX
        ));
        const newScrollTop = Math.max(0, Math.min(
          scrollableElement.scrollHeight - scrollableElement.clientHeight,
          panDragStart.scrollTop - deltaY
        ));
        
        scrollableElement.scrollLeft = newScrollLeft;
        scrollableElement.scrollTop = newScrollTop;
      };

      const handleMouseUp = () => {
        setIsPanDragging(false);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }, [isPanDragging, panDragStart]);

    return (
      <div className={`${styles.gridWrapper} ${className || ''}`}>
        <div 
          ref={gridContainerRef} 
          className={styles.gridContainer}
          onMouseDown={handlePanMouseDown}
          style={{ cursor: isPanDragging ? 'grabbing' : 'grab' }}
        >
          <AgGridReact
            ref={agGridRef}
            {...agGridProps}
          />
          
          {/* Custom Vertical Scrollbar */}
          {verticalConfig.enabled && !hideScrollbars && !hideVerticalScrollbar && (
            <AGGridCustomScrollbar 
              targetRef={gridContainerRef as React.RefObject<HTMLElement>} 
              orientation="vertical"
              marginTop={verticalConfig.marginTop}
              marginBottom={verticalConfig.marginBottom}
              marginToEnd={verticalConfig.marginToEnd}
              classNameThumb={verticalConfig.classNameThumb}
              classNameTrack={verticalConfig.classNameTrack}
            />
          )}

          {/* Custom Horizontal Scrollbar */}
          {horizontalConfig.enabled && !hideScrollbars && !hideHorizontalScrollbar && (
            <AGGridCustomScrollbar 
              targetRef={gridContainerRef as React.RefObject<HTMLElement>} 
              orientation="horizontal"
              marginLeft={horizontalConfig.marginLeft}
              marginRight={horizontalConfig.marginRight}
              marginToEnd={horizontalConfig.marginToEnd}
              classNameThumb={horizontalConfig.classNameThumb}
              classNameTrack={horizontalConfig.classNameTrack}
              thick={horizontalConfig.thick}
            />
          )}
        </div>
      </div>
    );
  }
);

AgGridWithCustomScrollbars.displayName = 'AgGridWithCustomScrollbars';
