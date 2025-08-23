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
  onDragEnd
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
        y: parsePosition(initialPosition.top)
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
  useEffect(() => {
    if (initialPosition && !userHasDragged) {
      console.log('Setting initial position (user has not dragged yet):', initialPosition);
      const newPos = getInitialPosition();
      setPosition(newPos);
    }
  }, [initialPosition, userHasDragged]);
  useEffect(() => {
    container.style.position = 'fixed';
    container.style.left = `${position.x}px`;
    container.style.top = `${position.y}px`;
    container.style.zIndex = '9999';
    container.style.pointerEvents = 'auto';
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

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (!enableDragging) return;
    
    const target = e.target as HTMLElement;
    
    console.log('Mouse down detected on:', target);
    console.log('Target classes:', target.className);
    console.log('Drag handle selector:', dragHandleSelector);
    
    // Check if we should handle this drag
    let shouldDrag = false;
    if (dragHandleSelector) {
      // Split selector by comma and check each one
      const selectors = dragHandleSelector.split(',').map(s => s.trim());
      shouldDrag = selectors.some(selector => {
        const element = target.closest(selector);
        console.log(`Checking selector "${selector}":`, element);
        return element !== null;
      });
    } else {
      // If no selector provided, make the entire container draggable
      shouldDrag = containerRef.current?.contains(target) || false;
    }

    console.log('Should drag:', shouldDrag);
    
    if (!shouldDrag) return;

    e.preventDefault();
    e.stopPropagation();

    const rect = container.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setDragStartPosition({ x: e.clientX, y: e.clientY });
    setHasDragged(false);
    setIsDragging(true);
    onDragStart?.();
    console.log('Drag started');
  }, [dragHandleSelector, container, enableDragging]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    console.log('Mouse move during drag');
    e.preventDefault();
    
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    // Check if we've moved enough to consider this a drag (threshold to distinguish from click)
    const moveThreshold = 5; // pixels
    const dragDistance = Math.sqrt(
      Math.pow(e.clientX - dragStartPosition.x, 2) + 
      Math.pow(e.clientY - dragStartPosition.y, 2)
    );
    
    if (dragDistance > moveThreshold && !hasDragged) {
      setHasDragged(true);
      console.log('Drag threshold exceeded - this is a real drag');
    }

    // Keep the portal within viewport bounds
    const maxX = window.innerWidth - 100; // Minimum 100px visible
    const maxY = window.innerHeight - 100;
    
    const clampedX = Math.max(0, Math.min(newX, maxX));
    const clampedY = Math.max(0, Math.min(newY, maxY));

    console.log(`Moving to: ${clampedX}, ${clampedY}`);
    setPosition({ x: clampedX, y: clampedY });
  }, [isDragging, dragOffset, dragStartPosition, hasDragged]);

  const handleMouseUp = useCallback(() => {
    console.log('Mouse up - ending drag, hasDragged:', hasDragged);
    setIsDragging(false);
    
    if (hasDragged) {
      console.log('User has dragged - position will be preserved');
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
    console.log('isDragging state changed to:', isDragging);
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
    console.log('Setting up mousedown listener on container:', currentContainer);
    
    const mouseDownHandler = (e: MouseEvent) => {
      console.log('Container mousedown event fired');
      handleMouseDown(e);
    };
    
    currentContainer.addEventListener('mousedown', mouseDownHandler);

    return () => {
      console.log('Removing mousedown listener from container');
      currentContainer.removeEventListener('mousedown', mouseDownHandler);
    };
  }, [container, handleMouseDown]);

  const portalContent = (
    <div 
      ref={containerRef}
      style={{
        cursor: !enableDragging ? 'default' : isDragging ? 'grabbing' : (dragHandleSelector ? 'default' : 'grab'),
        position: 'relative'
      }}
      onMouseDown={(e) => {
        console.log('Portal content mousedown event fired');
        console.log('Event target:', e.target);
        console.log('Current target:', e.currentTarget);
      }}
    >
      {children}
    </div>
  );

  return createPortal(portalContent, container);
};
