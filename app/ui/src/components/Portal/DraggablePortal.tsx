import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface DraggablePortalProps {
  children: React.ReactNode;
  initialX?: number;
  initialY?: number;
  initialPosition?: { left: string | number; top: string | number }; // Accept both string and number
  dragHandleSelector?: string; // CSS selector for the drag handle
  onPositionChange?: (x: number, y: number) => void;
  enableDragging?: boolean; // Allow disabling drag functionality
  onDragStart?: () => void; // Called when drag starts
  onDragEnd?: (wasDragged: boolean) => void; // Called when drag ends, with flag indicating if actually dragged
}

interface Position {
  x: number;
  y: number;
}

export const DraggablePortal: React.FC<DraggablePortalProps> = ({
  children,
  initialX = 100,
  initialY = 100,
  initialPosition,
  dragHandleSelector,
  onPositionChange,
  enableDragging = true,
  onDragStart,
  onDragEnd,
}) => {
  // Parse initial position if provided as string (e.g., "100px")
  const parsePosition = (pos: string | number): number => {
    if (typeof pos === 'string') {
      return parseInt(pos.replace('px', ''), 10) || 0;
    }
    return pos;
  };

  const getInitialPosition = (): Position => {
    if (initialPosition) {
      return {
        x: parsePosition(initialPosition.left),
        y: parsePosition(initialPosition.top),
      };
    }
    return { x: initialX, y: initialY };
  };

  const [container] = useState(() => document.createElement('div'));
  const [position, setPosition] = useState<Position>(getInitialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [dragStartPosition, setDragStartPosition] = useState<Position>({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);
  const [userHasDragged, setUserHasDragged] = useState(false); // Track if user has ever dragged
  const containerRef = useRef<HTMLDivElement>(null);

  // Only set initial position if user hasn't dragged yet
  // Use individual values in deps to avoid object reference comparison issues
  const initialLeft = initialPosition?.left;
  const initialTop = initialPosition?.top;
  
  useEffect(() => {
    if (initialLeft !== undefined && initialTop !== undefined && !userHasDragged) {
      const newPos = {
        x: parsePosition(initialLeft),
        y: parsePosition(initialTop),
      };
      setPosition(newPos);
    }
  }, [initialLeft, initialTop, userHasDragged]);
  useEffect(() => {
    container.style.position = 'fixed';
    container.style.left = `${position.x}px`;
    container.style.top = `${position.y}px`;
    container.style.zIndex = '9999';
    container.style.pointerEvents = 'auto';
    // Ensure the container fully captures mouse events
    container.style.isolation = 'isolate';
    document.body.appendChild(container);

    return () => {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
  }, [container]);

  // Update container position when position state changes
  useEffect(() => {
    container.style.left = `${position.x}px`;
    container.style.top = `${position.y}px`;
    onPositionChange?.(position.x, position.y);
  }, [position, container, onPositionChange]);

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!enableDragging) return;

      const target = e.target as HTMLElement;

      // Check if we should handle this drag
      let shouldDrag = false;
      if (dragHandleSelector) {
        // Split selector by comma and check each one
        const selectors = dragHandleSelector.split(',').map(s => s.trim());
        shouldDrag = selectors.some(selector => {
          const element = target.closest(selector);
          return element !== null;
        });
      } else {
        // If no selector provided, make the entire container draggable
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
    [dragHandleSelector, container, enableDragging]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      e.preventDefault();

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Check if we've moved enough to consider this a drag (threshold to distinguish from click)
      const moveThreshold = 5; // pixels
      const dragDistance = Math.sqrt(
        Math.pow(e.clientX - dragStartPosition.x, 2) + Math.pow(e.clientY - dragStartPosition.y, 2)
      );

      if (dragDistance > moveThreshold && !hasDragged) {
        setHasDragged(true);
      }

      // Allow dragging anywhere - no viewport bounds restriction
      // The panels themselves handle their own positioning
      setPosition({ x: newX, y: newY });
    },
    [isDragging, dragOffset, dragStartPosition, hasDragged]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);

    if (hasDragged) {
      setUserHasDragged(true); // Mark that user has dragged, so we won't reset position
    }

    onDragEnd?.(hasDragged);

    // Reset hasDragged after a short delay to prevent immediate clicks
    setTimeout(() => {
      setHasDragged(false);
    }, 100);
  }, [hasDragged, onDragEnd]);

  // Debug logging for drag state
  useEffect(() => {
  }, [isDragging]);

  // Set up global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Set up mousedown listener on the container
  useEffect(() => {
    const currentContainer = container;

    const mouseDownHandler = (e: MouseEvent) => {
      // Always stop propagation to prevent underlying elements from receiving the event
      e.stopPropagation();
      handleMouseDown(e);
    };

    // Also prevent other drag-related events from reaching underlying elements
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
  }, [container, handleMouseDown]);

  const portalContent = (
    <div
      ref={containerRef}
      style={{
        cursor: !enableDragging
          ? 'default'
          : isDragging
            ? 'grabbing'
            : dragHandleSelector
              ? 'default'
              : 'grab',
        position: 'relative',
        pointerEvents: 'auto', // Ensure this captures all pointer events
      }}
      onMouseDown={(e) => {
        // Prevent mouse events from reaching underlying elements
        e.stopPropagation();
      }}
      onDragStart={(e) => {
        // Prevent native drag behavior
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {children}
    </div>
  );

  return createPortal(portalContent, container);
};
