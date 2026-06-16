import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';

interface InfoPortalProps {
  children: React.ReactNode;
  triggerRef: React.RefObject<HTMLElement | null>;
  offsetX?: number;
  offsetY?: number;
  position?: 'below' | 'above' | 'right' | 'left';
  alignment?: 'left' | 'center' | 'right';
  debug?: boolean;
  onHideRequest?: () => void; // Callback when portal wants to hide itself
}

export const InfoPortal: React.FC<InfoPortalProps> = ({
  children,
  triggerRef,
  offsetX = 0,
  offsetY = 0,
  position = 'below',
  alignment = 'left',
  debug = false,
  onHideRequest,
}) => {
  const [container] = useState(() => document.createElement('div'));
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    container.style.position = 'absolute';
    container.style.zIndex = '9999';
    container.style.pointerEvents = 'none'; // Allow clicks to pass through the container
    document.body.appendChild(container);

    return () => {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
  }, [container]);

  useEffect(() => {
    let animationFrameId: number;
    let isMonitoring = false;

    const updatePosition = () => {
      if (triggerRef.current && contentRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const contentRect = contentRef.current.getBoundingClientRect();

        let x = 0;
        let y = 0;

        // First determine the primary position (which side of the trigger)
        switch (position) {
          case 'above':
            // Place above the trigger
            y = rect.top + window.scrollY - contentRect.height - offsetY;
            break;
          case 'below':
            // Place below the trigger
            y = rect.bottom + window.scrollY + offsetY;
            break;
          case 'right':
            // Place to the right of the trigger
            x = rect.right + window.scrollX + offsetX;
            break;
          case 'left':
            // Place to the left of the trigger
            x = rect.left + window.scrollX - contentRect.width - offsetX;
            break;
        }

        // Now apply alignment for the other axis
        if (position === 'above' || position === 'below') {
          // For above/below positions, alignment affects horizontal positioning
          switch (alignment) {
            case 'left':
              // Align left edges
              x = rect.left + window.scrollX + offsetX;
              break;
            case 'center':
              // Center horizontally
              x = rect.left + window.scrollX + (rect.width / 2) - (contentRect.width / 2);
              break;
            case 'right':
              // Align right edges
              x = rect.right + window.scrollX - contentRect.width - offsetX;
              break;
          }
        } else if (position === 'left' || position === 'right') {
          // For left/right positions, alignment affects vertical positioning
          switch (alignment) {
            case 'left': // In this context, 'left' means 'top' alignment
              // Align top edges
              y = rect.top + window.scrollY + offsetY;
              break;
            case 'center':
              // Center vertically
              y = rect.top + window.scrollY + (rect.height / 2) - (contentRect.height / 2);
              break;
            case 'right': // In this context, 'right' means 'bottom' alignment
              // Align bottom edges
              y = rect.bottom + window.scrollY - contentRect.height - offsetY;
              break;
          }
        }

        // Update debug info (only if debug is enabled)
        if (debug) {
          const debugData = {
            alignment,
            position,
            triggerRect: {
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
              top: Math.round(rect.top),
              bottom: Math.round(rect.bottom),
            },
            contentRect: {
              width: Math.round(contentRect.width),
              height: Math.round(contentRect.height),
            },
            scroll: {
              x: Math.round(window.scrollX),
              y: Math.round(window.scrollY),
            },
            calculatedPosition: {
              x: Math.round(x),
              y: Math.round(y),
            },
            offsetX,
            offsetY,
          };

          setDebugInfo(debugData);
          console.log('InfoPortal:', debugData);
        } else {
          setDebugInfo(null);
        }

        container.style.left = `${x}px`;
        container.style.top = `${y}px`;
      }
    };

    // Continuous monitoring function
    const continuousUpdate = () => {
      updatePosition();
      if (isMonitoring) {
        animationFrameId = requestAnimationFrame(continuousUpdate);
      }
    };

    // Start continuous monitoring on mouse events
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

    // Initial position update with a slight delay to ensure content is rendered
    requestAnimationFrame(() => {
      updatePosition();
    });

    // Standard event listeners
    const handleUpdate = () => {
      updatePosition();
    };

    // Mouse events for continuous monitoring during drag
    document.addEventListener('mousedown', startMonitoring);
    document.addEventListener('mouseup', stopMonitoring);
    document.addEventListener('mouseleave', stopMonitoring);

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    // Enhanced ResizeObserver for both trigger and content
    let resizeObserver: ResizeObserver | null = null;
    if (triggerRef.current && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => {
        updatePosition();
      });
      resizeObserver.observe(triggerRef.current);
    }

    // Observe content size changes
    let contentResizeObserver: ResizeObserver | null = null;
    if (contentRef.current && 'ResizeObserver' in window) {
      contentResizeObserver = new ResizeObserver(() => {
        updatePosition();
      });
      contentResizeObserver.observe(contentRef.current);
    }

    return () => {
      stopMonitoring();
      document.removeEventListener('mousedown', startMonitoring);
      document.removeEventListener('mouseup', stopMonitoring);
      document.removeEventListener('mouseleave', stopMonitoring);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (contentResizeObserver) {
        contentResizeObserver.disconnect();
      }
    };
  }, [triggerRef, offsetX, offsetY, position, alignment, debug, container]);

  // Handle mouse leave to hide the portal
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!contentRef.current || !triggerRef.current) return;

      const contentRect = contentRef.current.getBoundingClientRect();
      const triggerRect = triggerRef.current.getBoundingClientRect();

      // Check if mouse is outside both the content and the trigger
      const isOutsideContent =
        e.clientX < contentRect.left ||
        e.clientX > contentRect.right ||
        e.clientY < contentRect.top ||
        e.clientY > contentRect.bottom;

      const isOutsideTrigger =
        e.clientX < triggerRect.left ||
        e.clientX > triggerRect.right ||
        e.clientY < triggerRect.top ||
        e.clientY > triggerRect.bottom;

      if (isOutsideContent && isOutsideTrigger) {
        onHideRequest?.();
      }
    };

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [triggerRef, onHideRequest]);

  // Re-enable pointer events on the portal content
  const portalContent = (
    <div ref={contentRef} style={{ pointerEvents: 'auto' }}>
      {children}
      {/* Debug display */}
      {debugInfo && (
        <div
          style={{
            position: 'fixed',
            top: '10px',
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
          <div>
            <strong>InfoPortal Debug:</strong>
          </div>
          <div>Position: {debugInfo.position}</div>
          <div>Alignment: {debugInfo.alignment}</div>
          <div>Trigger: {debugInfo.triggerRect.width}x{debugInfo.triggerRect.height}px</div>
          <div>Content: {debugInfo.contentRect.width}x{debugInfo.contentRect.height}px</div>
          <div>Portal pos: {debugInfo.calculatedPosition.x},{debugInfo.calculatedPosition.y}px</div>
        </div>
      )}
    </div>
  );

  return createPortal(portalContent, container);
};
