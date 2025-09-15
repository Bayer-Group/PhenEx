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
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  offsetX?: number;
  offsetY?: number;
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
  position = 'top-left',
  offsetX = 0,
  offsetY = 0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({
    width: initialWidth,
    height: initialHeight,
  });
  const [positionOffset, setPositionOffset] = useState({
    x: offsetX,
    y: offsetY,
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
      startOffsetX: positionOffset.x,
      startOffsetY: positionOffset.y,
    });

    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = direction.includes('e') || direction.includes('w') ? 'ew-resize' : 'ns-resize';
  }, [positionOffset.x, positionOffset.y]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizeState.isResizing || !containerRef.current) return;

    const deltaX = e.clientX - resizeState.startX;
    const deltaY = e.clientY - resizeState.startY;

    let newWidth = resizeState.startWidth;
    let newHeight = resizeState.startHeight;
    let newOffsetX = resizeState.startOffsetX;
    let newOffsetY = resizeState.startOffsetY;

    // Handle resize based on direction and positioning anchor
    if (resizeState.direction.includes('e')) {
      // Right edge - only change width for all positioning types
      newWidth = resizeState.startWidth + deltaX;
    }
    
    if (resizeState.direction.includes('w')) {
      // Left edge - change width and adjust position for right-anchored containers
      newWidth = resizeState.startWidth - deltaX;
      if (position.includes('right')) {
        newOffsetX = resizeState.startOffsetX + deltaX;
      }
    }
    
    if (resizeState.direction.includes('s')) {
      // Bottom edge - only change height for top-anchored containers
      newHeight = resizeState.startHeight + deltaY;
    }
    
    if (resizeState.direction.includes('n')) {
      // Top edge - change height and adjust position for bottom-anchored containers
      newHeight = resizeState.startHeight - deltaY;
      if (position.includes('bottom')) {
        newOffsetY = resizeState.startOffsetY + deltaY;
      }
    }

    // Apply constraints
    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

    setDimensions({ width: newWidth, height: newHeight });
    setPositionOffset({ x: newOffsetX, y: newOffsetY });
    onResize?.(newWidth, newHeight);
  }, [resizeState, minWidth, maxWidth, minHeight, maxHeight, onResize, position]);

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
    const baseStyles: React.CSSProperties = {
      width: `${dimensions.width}px`,
      height: `${dimensions.height}px`,
      position: 'absolute',
    };

    switch (position) {
      case 'top-left':
        return { ...baseStyles, top: positionOffset.y, left: positionOffset.x };
      case 'top-right':
        return { ...baseStyles, top: positionOffset.y, right: positionOffset.x };
      case 'bottom-left':
        return { ...baseStyles, bottom: positionOffset.y, left: positionOffset.x };
      case 'bottom-right':
        return { ...baseStyles, bottom: positionOffset.y, right: positionOffset.x };
      default:
        return { ...baseStyles, top: positionOffset.y, left: positionOffset.x };
    }
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
