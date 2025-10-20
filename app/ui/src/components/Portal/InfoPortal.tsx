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
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();

        // Calculate X position based on alignment
        let baseX = rect.left + window.scrollX;
        if (alignment === 'center') {
          baseX = rect.left + window.scrollX + rect.width / 2;
        } else if (alignment === 'right') {
          baseX = rect.right + window.scrollX;
        }

        let x = baseX + offsetX;
        let y = rect.bottom + window.scrollY + offsetY;

        switch (position) {
          case 'above':
            y = rect.top + window.scrollY - offsetY;
            break;
          case 'below':
            y = rect.bottom + window.scrollY + offsetY;
            break;
          case 'right':
            x = rect.right + window.scrollX + offsetX;
            y = rect.top + window.scrollY + offsetY;
            break;
          case 'left':
            x = rect.left + window.scrollX - offsetX;
            y = rect.top + window.scrollY + offsetY;
            break;
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
            scroll: {
              x: Math.round(window.scrollX),
              y: Math.round(window.scrollY),
            },
            calculatedPosition: {
              x: Math.round(x),
              y: Math.round(y),
            },
            baseX: Math.round(baseX),
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

    updatePosition();

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

    // Enhanced ResizeObserver
    let resizeObserver: ResizeObserver | null = null;
    if (triggerRef.current && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => {
        updatePosition();
      });
      resizeObserver.observe(triggerRef.current);
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
          <div>Width: {debugInfo.triggerRect.width}px</div>
          <div>Left: {debugInfo.triggerRect.left}px</div>
          <div>Right: {debugInfo.triggerRect.right}px</div>
          <div>Portal X: {debugInfo.calculatedPosition.x}px</div>
          <div>Alignment: {debugInfo.alignment}</div>
          <div>Base X: {debugInfo.baseX}px</div>
        </div>
      )}
    </div>
  );

  return createPortal(portalContent, container);
};
