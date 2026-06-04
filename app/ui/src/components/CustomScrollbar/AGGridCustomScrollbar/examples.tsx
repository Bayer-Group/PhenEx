import React, { useRef } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { CustomScrollbar } from '../CustomScrollbar';

// Example: Using CustomScrollbar with AG Grid
export const ExampleAgGridWithScrollbar: React.FC = () => {
  const gridContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{ position: 'relative', height: '400px', width: '100%' }}>
      <div 
        ref={gridContainerRef}
        style={{ height: '100%', width: '100%' }}
      >
        <AgGridReact
          // Your AG Grid props here
          rowData={[/* your data */]}
          columnDefs={[/* your columns */]}
          // Hide default scrollbars
          suppressHorizontalScroll={false}
          // Other AG Grid props...
        />
      </div>
      
      {/* Custom scrollbar */}
      <CustomScrollbar
        targetRef={gridContainerRef}
        className="accent" // Use accent colors
        width={14}
        position="right"
        offset={8}
      />
    </div>
  );
};

// Example: Using CustomScrollbar with regular div
export const ExampleDivWithScrollbar: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{ position: 'relative', height: '300px', width: '100%' }}>
      <div
        ref={containerRef}
        style={{
          height: '100%',
          width: '100%',
          overflow: 'hidden', // Hide default scrollbar
          padding: '16px',
        }}
      >
        {/* Your scrollable content here */}
        <div style={{ height: '1000px', background: 'linear-gradient(to bottom, red, blue)' }}>
          <p>This is scrollable content...</p>
          <p>Add lots of content here to make it scroll</p>
          {/* More content... */}
        </div>
      </div>
      
      {/* Custom scrollbar */}
      <CustomScrollbar
        targetRef={containerRef}
        className="dark" // Use dark theme
        width={12}
        position="right"
        offset={4}
      />
    </div>
  );
};
