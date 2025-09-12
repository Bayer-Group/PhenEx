import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface DraggablePositionedPortalProps {
  children: React.ReactNode;
  triggerRef: React.RefObject<HTMLElement | null>;
  offsetX?: number;
  offsetY?: number;
  position?: 'below' | 'above' | 'right' | 'left';
  alignment?: 'left' | 'center' | 'right';
  dragHandleSelector?: string; // CSS selector for the drag handle
  dragHandleRef?: React.RefObject<HTMLElement | null>; // Direct reference to drag handle element
  onPositionChange?: (x: number, y: number) => void;
  enableDragging?: boolean; // Allow disabling drag functionality
  onDragStart?: () => void; // Called when drag starts
  onDragEnd?: (wasDragged: boolean) => void; // Called when drag ends
  onClose?: () => void; // Called when portal should close
  resetToPositioned?: boolean; // When true, forces portal back to positioned mode
  debug?: boolean; // Debug flag
}

interface Position {
  x: number;
  y: number;
}

export const DraggablePositionedPortal: React.FC<DraggablePositionedPortalProps> = ({
  children,
  triggerRef,
  offsetX = 0,
  offsetY = 0,
  position = 'below',
  alignment = 'left',
  dragHandleSelector,
  dragHandleRef,
  onPositionChange,
  enableDragging = true,
  onDragStart,
  onDragEnd,
  onClose,
  resetToPositioned = false,
  debug = false,
}) => {
  const [container] = useState(() => document.createElement('div'));
  const [portalPosition, setPortalPosition] = useState<Position>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [dragStartPosition, setDragStartPosition] = useState<Position>({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);
  const [userHasDragged, setUserHasDragged] = useState(false); // Track if user has ever dragged
  const [isPositioned, setIsPositioned] = useState(true); // Start in positioned mode
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize container
  useEffect(() => {
    container.style.position = 'absolute';
    container.style.zIndex = '9999';
    container.style.pointerEvents = 'auto';
    container.style.isolation = 'isolate';
    document.body.appendChild(container);

    return () => {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
  }, [container]);

  // Calculate positioned coordinates based on trigger element
  const calculatePositionedCoordinates = useCallback((): Position => {
    if (!triggerRef.current) return { x: 0, y: 0 };

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

    // Update debug info if enabled
    if (debug) {
      const debugData = {
        mode: isPositioned ? 'positioned' : 'draggable',
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
    }

    return { x, y };
  }, [triggerRef, alignment, position, offsetX, offsetY, debug, isPositioned]);

  // Update portal position
  const updatePortalPosition = useCallback(() => {
    if (isPositioned && !userHasDragged) {
      // In positioned mode, calculate position based on trigger
      const newPos = calculatePositionedCoordinates();
      setPortalPosition(newPos);
      container.style.left = `${newPos.x}px`;
      container.style.top = `${newPos.y}px`;
      onPositionChange?.(newPos.x, newPos.y);
    } else {
      // In draggable mode, use the current portal position (read from state)
      setPortalPosition(current => {
        container.style.left = `${current.x}px`;
        container.style.top = `${current.y}px`;
        onPositionChange?.(current.x, current.y);
        return current; // No change to state
      });
    }
  }, [isPositioned, userHasDragged, calculatePositionedCoordinates, container, onPositionChange]);

  // Set up positioning monitoring (only when in positioned mode)
  useEffect(() => {
    if (!isPositioned || userHasDragged) return;

    let animationFrameId: number;
    let isMonitoring = false;

    const continuousUpdate = () => {
      updatePortalPosition();
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

    updatePortalPosition();

    // Event listeners for position updates
    const handleUpdate = () => updatePortalPosition();

    document.addEventListener('mousedown', startMonitoring);
    document.addEventListener('mouseup', stopMonitoring);
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    // Observers for trigger element changes
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    if (triggerRef.current && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => updatePortalPosition());
      resizeObserver.observe(triggerRef.current);
    }

    if (triggerRef.current && 'MutationObserver' in window) {
      mutationObserver = new MutationObserver(() => updatePortalPosition());
      mutationObserver.observe(triggerRef.current, {
        attributes: true,
        attributeFilter: ['style', 'class', 'width'],
      });
    }

    return () => {
      stopMonitoring();
      document.removeEventListener('mousedown', startMonitoring);
      document.removeEventListener('mouseup', stopMonitoring);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      if (resizeObserver) resizeObserver.disconnect();
      if (mutationObserver) mutationObserver.disconnect();
    };
  }, [isPositioned, userHasDragged, updatePortalPosition, triggerRef]);

  // Reset to positioned mode when resetToPositioned prop changes
  useEffect(() => {
    if (resetToPositioned) {
      setIsPositioned(true);
      setUserHasDragged(false);
      setHasDragged(false);
      setIsDragging(false);
      // Update position immediately to positioned coordinates
      updatePortalPosition();
      
      if (debug) {
        console.log('[DraggablePositionedPortal] Reset to positioned mode');
      }
    }
  }, [resetToPositioned, updatePortalPosition, debug]);

  // Dragging logic
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!enableDragging) return;

      const target = e.target as HTMLElement;

      // Check if we should handle this drag
      let shouldDrag = false;
      
      // Check dragHandleRef first (direct element reference)
      if (dragHandleRef?.current) {
        shouldDrag = dragHandleRef.current === target || dragHandleRef.current.contains(target);
      }
      // Fall back to dragHandleSelector if no direct ref
      else if (dragHandleSelector) {
        const selectors = dragHandleSelector.split(',').map(s => s.trim());
        shouldDrag = selectors.some(selector => target.closest(selector) !== null);
      } else {
        // If neither is specified, default to old behavior (drag anywhere in container)
        shouldDrag = containerRef.current?.contains(target) || false;
      }

      if (!shouldDrag) return;

      e.preventDefault();
      e.stopPropagation();

      const rect = container.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setDragStartPosition({ x: e.clientX, y: e.clientY });
      setHasDragged(false);
      setIsDragging(true);
      onDragStart?.();
    },
    [dragHandleSelector, dragHandleRef, container, enableDragging, onDragStart, containerRef]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      e.preventDefault();

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Check if we've moved enough to consider this a drag
      const moveThreshold = 5;
      const dragDistance = Math.sqrt(
        Math.pow(e.clientX - dragStartPosition.x, 2) + Math.pow(e.clientY - dragStartPosition.y, 2)
      );

      if (dragDistance > moveThreshold && !hasDragged) {
        setHasDragged(true);
        // Switch to draggable mode on first drag
        if (isPositioned) {
          setIsPositioned(false);
          setUserHasDragged(true);
        }
      }

      // NO CONSTRAINTS - allow portal to move anywhere freely
      const clampedX = newX;
      const clampedY = newY;

      setPortalPosition({ x: clampedX, y: clampedY });
      container.style.left = `${clampedX}px`;
      container.style.top = `${clampedY}px`;
      onPositionChange?.(clampedX, clampedY);
    },
    [isDragging, dragOffset, dragStartPosition, hasDragged, isPositioned, container, onPositionChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    onDragEnd?.(hasDragged);

    // Reset hasDragged after a delay
    setTimeout(() => {
      setHasDragged(false);
    }, 100);
  }, [hasDragged, onDragEnd]);

  // Set up global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Set up mousedown listener on container
  useEffect(() => {
    const currentContainer = container;

    const mouseDownHandler = (e: MouseEvent) => {
      // Only handle drag if we have a specific drag handle defined
      if (dragHandleRef?.current || dragHandleSelector) {
        const target = e.target as HTMLElement;
        let shouldDrag = false;
        
        // Check dragHandleRef first (direct element reference)
        if (dragHandleRef?.current) {
          shouldDrag = dragHandleRef.current === target || dragHandleRef.current.contains(target);
        }
        // Fall back to dragHandleSelector if no direct ref
        else if (dragHandleSelector) {
          const selectors = dragHandleSelector.split(',').map(s => s.trim());
          shouldDrag = selectors.some(selector => target.closest(selector) !== null);
        }
        
        if (!shouldDrag) {
          return; // Don't handle drag if target doesn't match the drag handle
        }
      } else {
        // If no drag handle is specified, allow buttons and other clickable elements to work normally
        const target = e.target as HTMLElement;
        if (target.tagName === 'BUTTON' || target.closest('button')) {
          return; // Don't interfere with button clicks
        }
      }
      
      e.stopPropagation();
      handleMouseDown(e);
    };

    const preventDragEvents = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
    };

    currentContainer.addEventListener('mousedown', mouseDownHandler);
    currentContainer.addEventListener('dragstart', preventDragEvents);
    currentContainer.addEventListener('dragover', preventDragEvents);
    currentContainer.addEventListener('drop', preventDragEvents);
    currentContainer.addEventListener('drag', preventDragEvents);

    return () => {
      currentContainer.removeEventListener('mousedown', mouseDownHandler);
      currentContainer.removeEventListener('dragstart', preventDragEvents);
      currentContainer.removeEventListener('dragover', preventDragEvents);
      currentContainer.removeEventListener('drop', preventDragEvents);
      currentContainer.removeEventListener('drag', preventDragEvents);
    };
  }, [container, handleMouseDown, dragHandleSelector, dragHandleRef]);

  const portalContent = (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        pointerEvents: 'auto',
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      onDragStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
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
          <div><strong>DraggablePositionedPortal Debug:</strong></div>
          <div>Mode: {debugInfo.mode}</div>
          <div>User Dragged: {userHasDragged ? 'Yes' : 'No'}</div>
          <div>Portal X: {debugInfo.calculatedPosition?.x || portalPosition.x}px</div>
          <div>Portal Y: {debugInfo.calculatedPosition?.y || portalPosition.y}px</div>
          <div>Alignment: {debugInfo.alignment}</div>
          <div>Position: {debugInfo.position}</div>
        </div>
      )}
    </div>
  );

  return createPortal(portalContent, container);
};
