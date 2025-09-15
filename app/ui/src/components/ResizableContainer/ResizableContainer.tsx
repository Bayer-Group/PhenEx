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
  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false,
    direction: '',
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
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
    });

    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = direction.includes('e') || direction.includes('w') ? 'ew-resize' : 'ns-resize';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizeState.isResizing || !containerRef.current) return;

    const deltaX = e.clientX - resizeState.startX;
    const deltaY = e.clientY - resizeState.startY;

    let newWidth = resizeState.startWidth;
    let newHeight = resizeState.startHeight;

    // Calculate new dimensions based on resize direction
    if (resizeState.direction.includes('e')) {
      newWidth = resizeState.startWidth + deltaX;
    }
    if (resizeState.direction.includes('w')) {
      newWidth = resizeState.startWidth - deltaX;
    }
    if (resizeState.direction.includes('s')) {
      newHeight = resizeState.startHeight + deltaY;
    }
    if (resizeState.direction.includes('n')) {
      newHeight = resizeState.startHeight - deltaY;
    }

    // Apply constraints
    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

    setDimensions({ width: newWidth, height: newHeight });
    onResize?.(newWidth, newHeight);
  }, [resizeState, minWidth, maxWidth, minHeight, maxHeight, onResize]);

  const handleMouseUp = useCallback(() => {
    setResizeState(prev => ({ ...prev, isResizing: false }));
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

  return (
    <div
      ref={containerRef}
      className={`${styles.resizableContainer} ${className}`}
      style={{
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
      }}
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
