import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PositionedPortalProps {
  children: React.ReactNode;
  triggerRef: React.RefObject<HTMLElement | null>;
  offsetX?: number;
  offsetY?: number;
  position?: 'below' | 'above' | 'right' | 'left';
  alignment?: 'left' | 'center' | 'right'; // New prop for X alignment
  debug?: boolean; // Debug flag to toggle debugging panel
}

export const PositionedPortal: React.FC<PositionedPortalProps> = ({
  children,
  triggerRef,
  offsetX = 0,
  offsetY = 0,
  position = 'below',
  alignment = 'left',
  debug = false,
}) => {
  const [container] = useState(() => document.createElement('div'));
  const [debugInfo, setDebugInfo] = useState<any>(null);

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

        // Update debug info and console log (only if debug is enabled)
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
          console.log('PositionedPortal:', debugData);
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

    // Enhanced ResizeObserver for programmatic size changes
    let resizeObserver: ResizeObserver | null = null;
    if (triggerRef.current && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(entries => {
        // ResizeObserver catches CSS transitions, animations, and programmatic changes
        updatePosition();
        if (debug) {
          console.log('ResizeObserver triggered on trigger element:', entries[0].contentRect);
        }
      });
      resizeObserver.observe(triggerRef.current);
    }

    // ALSO observe the parent elements that might be changing
    let parentResizeObserver: ResizeObserver | null = null;
    if (triggerRef.current && triggerRef.current.parentElement && 'ResizeObserver' in window) {
      parentResizeObserver = new ResizeObserver(entries => {
        updatePosition();
        if (debug) {
          console.log('ResizeObserver triggered on PARENT element:', entries[0].contentRect);
        }
      });
      parentResizeObserver.observe(triggerRef.current.parentElement);
    }

    // Enhanced MutationObserver for style and attribute changes
    let mutationObserver: MutationObserver | null = null;
    if (triggerRef.current && 'MutationObserver' in window) {
      mutationObserver = new MutationObserver(mutations => {
        let shouldUpdate = false;
        mutations.forEach(mutation => {
          if (
            mutation.type === 'attributes' &&
            (mutation.attributeName === 'style' ||
              mutation.attributeName === 'class' ||
              mutation.attributeName === 'width')
          ) {
            shouldUpdate = true;
            if (debug) {
              console.log(
                'MutationObserver - attribute changed:',
                mutation.attributeName,
                mutation.target
              );
            }
          }
        });
        if (shouldUpdate) {
          updatePosition();
        }
      });
      mutationObserver.observe(triggerRef.current, {
        attributes: true,
        attributeFilter: ['style', 'class', 'width'],
        subtree: false,
      });
    }

    // ALSO observe the parent for mutations
    let parentMutationObserver: MutationObserver | null = null;
    if (triggerRef.current && triggerRef.current.parentElement && 'MutationObserver' in window) {
      parentMutationObserver = new MutationObserver(mutations => {
        let shouldUpdate = false;
        mutations.forEach(mutation => {
          if (
            mutation.type === 'attributes' &&
            (mutation.attributeName === 'style' ||
              mutation.attributeName === 'class' ||
              mutation.attributeName === 'width')
          ) {
            shouldUpdate = true;
            if (debug) {
              console.log(
                'MutationObserver - PARENT attribute changed:',
                mutation.attributeName,
                mutation.target
              );
            }
          }
        });
        if (shouldUpdate) {
          updatePosition();
        }
      });
      parentMutationObserver.observe(triggerRef.current.parentElement, {
        attributes: true,
        attributeFilter: ['style', 'class', 'width'],
        subtree: true,
      });
    }

    // Additional monitoring for CSS transitions and animations
    let transitionMonitoring = false;
    const startTransitionMonitoring = () => {
      if (!transitionMonitoring) {
        transitionMonitoring = true;
        const monitorTransitions = () => {
          updatePosition();
          if (transitionMonitoring) {
            requestAnimationFrame(monitorTransitions);
          }
        };
        requestAnimationFrame(monitorTransitions);
      }
    };

    const stopTransitionMonitoring = () => {
      transitionMonitoring = false;
    };

    // Listen for CSS transition events
    if (triggerRef.current) {
      triggerRef.current.addEventListener('transitionstart', startTransitionMonitoring);
      triggerRef.current.addEventListener('transitionend', stopTransitionMonitoring);
      triggerRef.current.addEventListener('animationstart', startTransitionMonitoring);
      triggerRef.current.addEventListener('animationend', stopTransitionMonitoring);
    }

    return () => {
      stopMonitoring();
      stopTransitionMonitoring();
      document.removeEventListener('mousedown', startMonitoring);
      document.removeEventListener('mouseup', stopMonitoring);
      document.removeEventListener('mouseleave', stopMonitoring);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (parentResizeObserver) {
        parentResizeObserver.disconnect();
      }
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
      if (parentMutationObserver) {
        parentMutationObserver.disconnect();
      }
      // Clean up transition listeners
      if (triggerRef.current) {
        triggerRef.current.removeEventListener('transitionstart', startTransitionMonitoring);
        triggerRef.current.removeEventListener('transitionend', stopTransitionMonitoring);
        triggerRef.current.removeEventListener('animationstart', startTransitionMonitoring);
        triggerRef.current.removeEventListener('animationend', stopTransitionMonitoring);
      }
    };
  }, [triggerRef, offsetX, offsetY, position, alignment, debug, container]);

  // Re-enable pointer events on the portal content
  const portalContent = (
    <div style={{ pointerEvents: 'auto' }}>
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
            <strong>Portal Debug:</strong>
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
