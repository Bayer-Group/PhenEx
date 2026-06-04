import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './WidthAdjustedPortal.module.css';

interface WidthAdjustedPortalProps {
  children: React.ReactNode;
  leftPanelRef: React.RefObject<HTMLElement | null>;
  width: number; // Current width of the left panel
  isCollapsed: boolean;
  allowResize: boolean; // Whether dragging is enabled
  onWidthChange: (newWidth: number) => void; // Callback to update the left panel width
  minWidth?: number;
  marginLeft?: number; // Left margin for the portal content
  isHoverAnimating?: boolean; // Whether to show portal during hover animation
  onHoverEnter?: () => void; // Callback when portal is hovered
  onHoverLeave?: () => void; // Callback when portal hover ends
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
  marginLeft = 20,
  isHoverAnimating = false,
  onHoverEnter,
  onHoverLeave,
  debug = false,
}) => {
  const [container] = useState(() => document.createElement('div'));
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartWidth, setDragStartWidth] = useState(0);

  useEffect(() => {
    // Set up the portal container to overlay the left panel
    container.className = styles.portalContainer;
    container.style.width = `${width}px`;
    container.style.height = '100%';
    container.style.top = '0';
    container.style.left = '0';
    
    document.body.appendChild(container);

    return () => {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
  }, [container, width, marginLeft]);

  useEffect(() => {
    let animationFrameId: number;
    let isMonitoring = false;

    const updatePosition = () => {
      if (leftPanelRef.current) {
        const rect = leftPanelRef.current.getBoundingClientRect();
        
        // Position portal to align right edge with left panel's right edge
        // The portal starts marginLeft pixels from the left, so its width is (leftPanelWidth - marginLeft)
        const portalWidth = width - marginLeft;
        const portalLeft = rect.left + marginLeft;
        
        container.style.left = `${portalLeft + window.scrollX}px`;
        container.style.top = `${rect.top + window.scrollY}px`;
        container.style.width = `${portalWidth}px`;
        container.style.height = `${rect.height}px`;
        container.style.display = 'block';
        
        // Set CSS variable for margin to use in transform calculation
        container.style.setProperty('--margin-left', `${marginLeft}px`);
        
        // Set CSS classes for animation states
        const classes = [styles.portalContainer];
        if (isHoverAnimating) classes.push(styles.hoverAnimating);
        if (isCollapsed) classes.push(styles.collapsed);
        container.className = classes.join(' ');

        if (debug) {
          const debugData = {
            leftPanelRect: {
              left: Math.round(rect.left),
              top: Math.round(rect.top),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            portalWidth: portalWidth,
            leftPanelWidth: width,
            marginLeft,
            isCollapsed,
            isHoverAnimating,
            className: container.className,
            scroll: {
              x: Math.round(window.scrollX),
              y: Math.round(window.scrollY),
            },
            portalPosition: {
              left: `${portalLeft + window.scrollX}px`,
              top: `${rect.top + window.scrollY}px`,
            },
          };
          setDebugInfo(debugData);
        }
      } else {
        // No left panel ref available
        container.style.display = 'none';
        if (debug) {
          setDebugInfo({ error: 'No left panel ref' });
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
        container.className = `${styles.portalContainer} ${styles.dragging}`;
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
      if (!isCollapsed){
        setIsDragging(false);
        container.className = styles.portalContainer;
        stopMonitoring();
      }

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
  }, [leftPanelRef, width, isCollapsed, allowResize, onWidthChange, minWidth, marginLeft, isDragging, dragStartX, dragStartWidth, debug, container]);

  // Update width whenever it changes
  useEffect(() => {
    const portalWidth = width - marginLeft;
    container.style.width = `${portalWidth}px`;
  }, [width, marginLeft, container]);

  const portalContent = (
    <div 
      className={`${styles.portalContent} ${isDragging ? styles.dragging : ''}`}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
    >
      {children}
      
      {/* Resize handle on the right edge */}
      {allowResize && !isCollapsed && (
        <div
          className={`${styles.resizeHandle} ${isDragging ? styles.dragging : ''}`}
        />
      )}
      
      {/* Debug display */}
      {debug && debugInfo && (
        <div className={styles.debugPanel}>
          <div className={styles.debugTitle}>WidthAdjustedPortal Debug:</div>
          {debugInfo.collapsed ? (
            <div className={`${styles.debugItem} ${styles.debugCollapsed}`}>
              Status: COLLAPSED
            </div>
          ) : (
            <>
              <div className={styles.debugItem}>Portal Width: {debugInfo.portalWidth}px</div>
              <div className={styles.debugItem}>Left Panel: {debugInfo.leftPanelRect.width}x{debugInfo.leftPanelRect.height}</div>
              <div className={styles.debugItem}>Position: {debugInfo.portalPosition.left}, {debugInfo.portalPosition.top}</div>
            </>
          )}
        </div>
      )}
    </div>
  );

  return createPortal(portalContent, container);
};