import React, { useRef, useState, useCallback, useEffect } from 'react';
import styles from './ResizableContainer.module.css';

export interface ResizableContainerProps {
  children: React.ReactNode;
  className?: string;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  onResize?: (width: number, height: number) => void;
  enableResize?: {
    top?: boolean;
    right?: boolean;
    bottom?: boolean;
    left?: boolean;
  };
}

interface ResizeState {
  isResizing: boolean;
  direction: string;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  startOffsetX: number;
  startOffsetY: number;
}

export const ResizableContainer: React.FC<ResizableContainerProps> = ({
  children,
  className = '',
  initialWidth = 400,
  initialHeight = 500,
  minWidth = 200,
  minHeight = 150,
  maxWidth = 800,
  maxHeight = 800,
  onResize,
  enableResize = { top: true, right: true, bottom: false, left: false },
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({
    width: initialWidth,
    height: initialHeight,
  });
  const [positionAdjustment, setPositionAdjustment] = useState({
    x: 0,
    y: 0,
  });
  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false,
    direction: '',
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    startOffsetX: 0,
    startOffsetY: 0,
  });

  const handleMouseDown = useCallback((e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setResizeState({
      isResizing: true,
      direction,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
      startOffsetX: positionAdjustment.x, // Store current adjustment
      startOffsetY: positionAdjustment.y, // Store current adjustment
    });

    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = direction.includes('e') || direction.includes('w') ? 'ew-resize' : 'ns-resize';
  }, [positionAdjustment.x, positionAdjustment.y]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizeState.isResizing || !containerRef.current) return;

    const deltaX = e.clientX - resizeState.startX;
    const deltaY = e.clientY - resizeState.startY;

    let newWidth = resizeState.startWidth;
    let newHeight = resizeState.startHeight;
    let adjustX = resizeState.startOffsetX; // Start from the initial adjustment
    let adjustY = resizeState.startOffsetY; // Start from the initial adjustment

    // Intuitive resizing: opposite edge stays fixed
    if (resizeState.direction.includes('e')) {
      // Right edge - increase width and compensate for translate(-width) change
      newWidth = resizeState.startWidth + deltaX;
      adjustX = resizeState.startOffsetX + deltaX; // Add deltaX to compensate
    }
    
    if (resizeState.direction.includes('w')) {
      // Left edge - decrease width and shift position so right edge stays fixed  
      newWidth = resizeState.startWidth - deltaX;
      // No position adjustment needed - the width change handles the positioning
    }
    
    if (resizeState.direction.includes('s')) {
      // Bottom edge - increase height and compensate for translate(-height) change
      newHeight = resizeState.startHeight + deltaY;
      adjustY = resizeState.startOffsetY + deltaY; // Add deltaY to compensate
    }
    
    if (resizeState.direction.includes('n')) {
      // Top edge - decrease height and shift position so bottom edge stays fixed
      newHeight = resizeState.startHeight - deltaY;
      // No position adjustment needed - the height change handles the positioning
    }

    // Apply constraints
    const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    const constrainedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

    setDimensions({ width: constrainedWidth, height: constrainedHeight });
    setPositionAdjustment({ x: adjustX, y: adjustY });
    onResize?.(constrainedWidth, constrainedHeight);
  }, [resizeState, minWidth, maxWidth, minHeight, maxHeight, onResize]);

  const handleMouseUp = useCallback(() => {
    setResizeState(prev => ({ 
      ...prev, 
      isResizing: false 
    }));
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, []);

  // Global mouse events for resizing
  useEffect(() => {
    if (resizeState.isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizeState.isResizing, handleMouseMove, handleMouseUp]);

  const renderResizeHandle = (direction: string, enabled: boolean) => {
    if (!enabled) return null;

    const isVertical = direction.includes('n') || direction.includes('s');
    const cursorClass = isVertical ? styles.resizeHandleVertical : styles.resizeHandleHorizontal;

    return (
      <div
        key={direction}
        className={`${styles.resizeHandle} ${styles[`resizeHandle${direction.toUpperCase()}`]} ${cursorClass}`}
        onMouseDown={(e) => handleMouseDown(e, direction)}
      />
    );
  };

  const getPositionStyles = (): React.CSSProperties => {
    return {
      width: `${dimensions.width}px`,
      height: `${dimensions.height}px`,
      position: 'relative',
      // Position so bottom-right corner is at origin (0,0) + any adjustments for left/top resizing
      transform: `translate(${-dimensions.width + positionAdjustment.x}px, ${-dimensions.height + positionAdjustment.y}px)`,
    };
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.resizableContainer} ${className}`}
      style={getPositionStyles()}
    >
      {children}
      
      {/* Resize handles */}
      {renderResizeHandle('n', enableResize.top || false)}
      {renderResizeHandle('e', enableResize.right || false)}
      {renderResizeHandle('s', enableResize.bottom || false)}
      {renderResizeHandle('w', enableResize.left || false)}
    </div>
  );
};
