import React, { forwardRef, useRef, useEffect } from 'react';
import { AgGridReact, AgGridReactProps } from '@ag-grid-community/react';
import { AGGridCustomScrollbar } from '../CustomScrollbar/AGGridCustomScrollbar';
import styles from './AgGridWithCustomScrollbars.module.css';

export interface AgGridWithCustomScrollbarsProps extends AgGridReactProps {
  // Additional props for customizing scrollbars
  scrollbarConfig?: {
    vertical?: {
      enabled?: boolean;
      height?: string | number;
      classNameThumb?: string;
      classNameTrack?: string;
    };
    horizontal?: {
      enabled?: boolean;
      width?: string | number;
      classNameThumb?: string;
      classNameTrack?: string;
    };
  };
}

export const AgGridWithCustomScrollbars = forwardRef<any, AgGridWithCustomScrollbarsProps>(
  ({ scrollbarConfig, className, ...agGridProps }, ref) => {
    const gridContainerRef = useRef<HTMLDivElement>(null);

    // Default scrollbar settings
    const verticalConfig = {
      enabled: true,
      height: "85%",
      classNameThumb: '',
      classNameTrack: '',
      ...scrollbarConfig?.vertical
    };

    const horizontalConfig = {
      enabled: true,
      width: "85%",
      classNameThumb: '',
      classNameTrack: '',
      ...scrollbarConfig?.horizontal
    };

    // Debug effect to check scrollbar hiding
    useEffect(() => {
      // Initial setup for hiding AG Grid scrollbars
    }, [verticalConfig.enabled, horizontalConfig.enabled]);

    return (
      <div className={`${styles.gridWrapper} ${className || ''}`}>
        <div ref={gridContainerRef} className={styles.gridContainer}>
          <AgGridReact
            ref={ref}
            {...agGridProps}
          />
          
          {/* Custom Vertical Scrollbar */}
          {verticalConfig.enabled && (
            <AGGridCustomScrollbar 
              targetRef={gridContainerRef as React.RefObject<HTMLElement>} 
              orientation="vertical"
              height={verticalConfig.height}
              classNameThumb={verticalConfig.classNameThumb}
              classNameTrack={verticalConfig.classNameTrack}
            />
          )}

          {/* Custom Horizontal Scrollbar */}
          {horizontalConfig.enabled && (
            <AGGridCustomScrollbar 
              targetRef={gridContainerRef as React.RefObject<HTMLElement>} 
              orientation="horizontal"
              width={horizontalConfig.width}
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
