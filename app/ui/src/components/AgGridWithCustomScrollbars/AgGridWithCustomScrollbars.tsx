import React, { forwardRef, useRef, useEffect } from 'react';
import { AgGridReact, AgGridReactProps } from '@ag-grid-community/react';
import { CustomScrollbar } from '../CustomScrollbar';
import styles from './AgGridWithCustomScrollbars.module.css';

export interface AgGridWithCustomScrollbarsProps extends AgGridReactProps {
  // Additional props for customizing the vertical scrollbar
  scrollbarConfig?: {
    enabled?: boolean;
    height?: string | number;
    marginBottom?: string | number;
    classNameThumb?: string;
    classNameTrack?: string;
  };
}

export const AgGridWithCustomScrollbars = forwardRef<any, AgGridWithCustomScrollbarsProps>(
  ({ scrollbarConfig, className, ...agGridProps }, ref) => {
    const gridContainerRef = useRef<HTMLDivElement>(null);

    // Default scrollbar settings
    const config = {
      enabled: true,
      height: "85%",
      marginBottom: 20,
      classNameThumb: '',
      classNameTrack: '',
      ...scrollbarConfig
    };

    // Debug effect to check scrollbar hiding
    useEffect(() => {
      if (gridContainerRef.current) {
        const viewport = gridContainerRef.current.querySelector('.ag-body-viewport');
        if (viewport) {
          console.log('AgGridWithCustomScrollbars Debug:', {
            container: gridContainerRef.current,
            viewport,
            viewportStyles: {
              scrollbarWidth: getComputedStyle(viewport).scrollbarWidth,
              msOverflowStyle: (getComputedStyle(viewport) as any).msOverflowStyle
            },
            containerClasses: gridContainerRef.current.className,
            wrapperClasses: gridContainerRef.current.parentElement?.className
          });
        }
      }
    }, []);

    return (
      <div className={`${styles.gridWrapper} ${className || ''}`}>
        <div ref={gridContainerRef} className={styles.gridContainer}>
          <AgGridReact
            ref={ref}
            {...agGridProps}
          />
          
          {/* Custom Vertical Scrollbar */}
          {config.enabled && (
            <CustomScrollbar 
              targetRef={gridContainerRef as React.RefObject<HTMLElement>} 
              height={config.height}
              marginBottom={config.marginBottom}
              classNameThumb={config.classNameThumb}
              classNameTrack={config.classNameTrack}
            />
          )}
        </div>
      </div>
    );
  }
);

AgGridWithCustomScrollbars.displayName = 'AgGridWithCustomScrollbars';
