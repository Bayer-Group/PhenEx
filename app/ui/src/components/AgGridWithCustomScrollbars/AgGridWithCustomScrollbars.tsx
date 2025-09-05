import React, { forwardRef, useRef, useEffect } from 'react';
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
      marginLeft: 200,
      marginRight: 10, // Space for vertical scrollbar area
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
