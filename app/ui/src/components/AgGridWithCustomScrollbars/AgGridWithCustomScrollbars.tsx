import React, { forwardRef, useRef, useEffect, useState } from 'react';
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
      classNameThumb?: string;
      classNameTrack?: string;
    };
    horizontal?: {
      enabled?: boolean;
      marginLeft?: number;
      marginRight?: number;
      classNameThumb?: string;
      classNameTrack?: string;
    };
  };
}

export const AgGridWithCustomScrollbars = forwardRef<any, AgGridWithCustomScrollbarsProps>(
  ({ scrollbarConfig, className, ...agGridProps }, ref) => {
    const gridContainerRef = useRef<HTMLDivElement>(null);
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
      classNameThumb: '',
      classNameTrack: '',
      ...scrollbarConfig?.vertical
    };

    const horizontalConfig = {
      enabled: true,
      marginLeft: 10,
      marginRight: 10, // Space for vertical scrollbar area
      classNameThumb: '',
      classNameTrack: '',
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
            ref={ref}
            {...agGridProps}
          />
          
          {/* Custom Vertical Scrollbar */}
          {verticalConfig.enabled && (
            <AGGridCustomScrollbar 
              targetRef={gridContainerRef as React.RefObject<HTMLElement>} 
              orientation="vertical"
              marginTop={verticalConfig.marginTop}
              marginBottom={verticalConfig.marginBottom}
              classNameThumb={verticalConfig.classNameThumb}
              classNameTrack={verticalConfig.classNameTrack}
            />
          )}

          {/* Custom Horizontal Scrollbar */}
          {horizontalConfig.enabled && (
            <AGGridCustomScrollbar 
              targetRef={gridContainerRef as React.RefObject<HTMLElement>} 
              orientation="horizontal"
              marginLeft={horizontalConfig.marginLeft}
              marginRight={horizontalConfig.marginRight}
              classNameThumb={horizontalConfig.classNameThumb}
              classNameTrack={horizontalConfig.classNameTrack}
            />
          )}
        </div>
      </div>
    );
  }
);

AgGridWithCustomScrollbars.displayName = 'AgGridWithCustomScrollbars';
