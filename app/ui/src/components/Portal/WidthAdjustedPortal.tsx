import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface WidthAdjustedPortalProps {
  children: React.ReactNode;
  leftPanelRef: React.RefObject<HTMLElement | null>;
  width: number; // Current width of the left panel
  isCollapsed: boolean;
  allowResize: boolean; // Whether dragging is enabled
  onWidthChange: (newWidth: number) => void; // Callback to update the left panel width
  minWidth?: number;
  debug?: boolean;
}

export const WidthAdjustedPortal: React.FC<WidthAdjustedPortalProps> = ({
  children,
  leftPanelRef,
  width,
  isCollapsed,
  allowResize,
  onWidthChange,
  minWidth = 200,
  debug = false,
}) => {
  const [container] = useState(() => document.createElement('div'));
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartWidth, setDragStartWidth] = useState(0);

  useEffect(() => {
    // Set up the portal container to overlay the left panel
    container.style.position = 'absolute';
    container.style.zIndex = '10001'; // Just above the left panel (which has z-index: 10000)
    container.style.pointerEvents = 'none'; // Allow clicks to pass through to the left panel
    container.style.width = `${width}px`;
    container.style.height = '100%';
    container.style.top = '0';
    container.style.left = '0';
    container.style.overflow = 'hidden';
    
    // Add shadow casting
    container.style.boxShadow = '10px 0 20px 0 red';
    container.style.backgroundColor = 'transparent';
    
    document.body.appendChild(container);

    return () => {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
  }, [container, width]);

  useEffect(() => {
    let animationFrameId: number;
    let isMonitoring = false;

    const updatePosition = () => {
      if (leftPanelRef.current && !isCollapsed) {
        const rect = leftPanelRef.current.getBoundingClientRect();
        
        // Position the portal exactly over the left panel
        container.style.left = `${rect.left + window.scrollX}px`;
        container.style.top = `${rect.top + window.scrollY}px`;
        container.style.width = `${width}px`;
        container.style.height = `${rect.height}px`;
        container.style.display = 'block';

        if (debug) {
          const debugData = {
            leftPanelRect: {
              left: Math.round(rect.left),
              top: Math.round(rect.top),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            portalWidth: width,
            scroll: {
              x: Math.round(window.scrollX),
              y: Math.round(window.scrollY),
            },
            portalPosition: {
              left: `${rect.left + window.scrollX}px`,
              top: `${rect.top + window.scrollY}px`,
            },
          };
          setDebugInfo(debugData);
          console.log('WidthAdjustedPortal:', debugData);
        }
      } else if (isCollapsed) {
        // Hide the portal when left panel is collapsed
        container.style.display = 'none';
        if (debug) {
          setDebugInfo({ collapsed: true });
        }
      }
    };

    // Continuous monitoring during resize/drag
    const continuousUpdate = () => {
      updatePosition();
      if (isMonitoring) {
        animationFrameId = requestAnimationFrame(continuousUpdate);
      }
    };

    const startMonitoring = () => {
      if (!isMonitoring) {
        isMonitoring = true;
        continuousUpdate();
      }
    };

    const stopMonitoring = () => {
      isMonitoring = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };

    updatePosition();

    // Drag handlers for resizing
    const handleMouseDown = (e: MouseEvent) => {
      if (!allowResize || isCollapsed) return;
      
      // Check if the mouse is near the right edge of the portal
      const rect = container.getBoundingClientRect();
      const edgeThreshold = 10; // pixels from right edge
      const isNearRightEdge = (e.clientX >= rect.right - edgeThreshold && e.clientX <= rect.right + edgeThreshold);
      
      if (isNearRightEdge) {
        setIsDragging(true);
        setDragStartX(e.clientX);
        setDragStartWidth(width);
        container.style.cursor = 'col-resize';
        e.preventDefault();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!allowResize || isCollapsed) return;
      
      if (isDragging) {
        const deltaX = e.clientX - dragStartX;
        const newWidth = Math.max(minWidth, dragStartWidth + deltaX);
        onWidthChange(newWidth);
      } else {
        // Show resize cursor when hovering near right edge
        const rect = container.getBoundingClientRect();
        const edgeThreshold = 10;
        const isNearRightEdge = (e.clientX >= rect.right - edgeThreshold && e.clientX <= rect.right + edgeThreshold);
        container.style.cursor = isNearRightEdge ? 'col-resize' : 'default';
      }
      
      if (isMonitoring) updatePosition();
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      container.style.cursor = 'default';
      stopMonitoring();
    };

    // Listen for drag events
    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    // Watch for changes to the left panel
    let resizeObserver: ResizeObserver | null = null;
    if (leftPanelRef.current && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => {
        updatePosition();
      });
      resizeObserver.observe(leftPanelRef.current);
    }

    return () => {
      stopMonitoring();
      container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [leftPanelRef, width, isCollapsed, allowResize, onWidthChange, minWidth, isDragging, dragStartX, dragStartWidth, debug, container]);

  // Update width whenever it changes
  useEffect(() => {
    container.style.width = `${width}px`;
  }, [width, container]);

  const portalContent = (
    <div 
      style={{ 
        pointerEvents: 'auto',
        width: '100%',
        height: '100%',
        position: 'relative'
      }}
    >
      {children}
      
      {/* Resize handle on the right edge */}
      {allowResize && !isCollapsed && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: -5,
            width: '10px',
            height: '100%',
            cursor: 'col-resize',
            backgroundColor: isDragging ? 'rgba(0,123,255,0.3)' : 'transparent',
            borderRight: isDragging ? '2px solid #007bff' : 'none',
            zIndex: 10002,
          }}
        />
      )}
      
      {/* Debug display */}
      {debug && debugInfo && (
        <div
          style={{
            position: 'fixed',
            top: '50px',
            right: '10px',
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '10px',
            fontSize: '12px',
            fontFamily: 'monospace',
            borderRadius: '4px',
            zIndex: 10000,
            maxWidth: '300px',
          }}
        >
          <div><strong>WidthAdjustedPortal Debug:</strong></div>
          {debugInfo.collapsed ? (
            <div>Status: COLLAPSED</div>
          ) : (
            <>
              <div>Portal Width: {debugInfo.portalWidth}px</div>
              <div>Left Panel: {debugInfo.leftPanelRect.width}x{debugInfo.leftPanelRect.height}</div>
              <div>Position: {debugInfo.portalPosition.left}, {debugInfo.portalPosition.top}</div>
            </>
          )}
        </div>
      )}
    </div>
  );

  return createPortal(portalContent, container);
};