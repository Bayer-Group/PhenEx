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
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'relative';
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
  position = 'relative',
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
  const [relativeTransform, setRelativeTransform] = useState({
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

    if (position === 'relative') {
      // For relative positioning within a portal
      if (resizeState.direction.includes('e')) {
        // Right edge - expand to the right (right edge moves, left stays fixed)
        newWidth = resizeState.startWidth + deltaX;
      }
      
      if (resizeState.direction.includes('w')) {
        // Left edge - expand to the left (left edge moves, right stays fixed)
        newWidth = resizeState.startWidth - deltaX;
        // Move the container left to keep the right edge fixed
        newOffsetX = resizeState.startOffsetX + deltaX;
      }
      
      if (resizeState.direction.includes('s')) {
        // Bottom edge - expand downward (bottom edge moves, top stays fixed)
        newHeight = resizeState.startHeight + deltaY;
      }
      
      if (resizeState.direction.includes('n')) {
        // Top edge - expand upward (top edge moves, bottom stays fixed)
        newHeight = resizeState.startHeight - deltaY;
        // Move the container up to keep the bottom edge fixed
        newOffsetY = resizeState.startOffsetY + deltaY;
      }
    } else {
      // Original absolute positioning logic
      if (resizeState.direction.includes('e')) {
        newWidth = resizeState.startWidth + deltaX;
      }
      
      if (resizeState.direction.includes('w')) {
        newWidth = resizeState.startWidth - deltaX;
        newOffsetX = resizeState.startOffsetX + deltaX;
      }
      
      if (resizeState.direction.includes('s')) {
        newHeight = resizeState.startHeight + deltaY;
      }
      
      if (resizeState.direction.includes('n')) {
        newHeight = resizeState.startHeight - deltaY;
        newOffsetY = resizeState.startOffsetY + deltaY;
      }
    }

    // Apply constraints
    const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    const constrainedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

    // If width was constrained, adjust offset accordingly
    if (constrainedWidth !== newWidth && resizeState.direction.includes('w')) {
      const widthDiff = newWidth - constrainedWidth;
      newOffsetX = resizeState.startOffsetX + deltaX - widthDiff;
    }

    // If height was constrained, adjust offset accordingly
    if (constrainedHeight !== newHeight && resizeState.direction.includes('n')) {
      const heightDiff = newHeight - constrainedHeight;
      newOffsetY = resizeState.startOffsetY + deltaY - heightDiff;
    }

    setDimensions({ width: constrainedWidth, height: constrainedHeight });
    if (position !== 'relative') {
      setPositionOffset({ x: newOffsetX, y: newOffsetY });
    } else {
      // For relative positioning, update the transform state
      setRelativeTransform({ x: newOffsetX, y: newOffsetY });
    }
    onResize?.(constrainedWidth, constrainedHeight);
  }, [resizeState, minWidth, maxWidth, minHeight, maxHeight, onResize, position, relativeTransform]);

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
    };

    if (position === 'relative') {
      return {
        ...baseStyles,
        position: 'relative',
        // Position the container so its bottom-right corner is at the origin (0,0)
        // This means we need to offset it by its full width and height
        // Plus any additional transform from resizing
        transform: `translate(${-dimensions.width + relativeTransform.x}px, ${-dimensions.height + relativeTransform.y}px)`,
      };
    }

    // Absolute positioning for other modes
    const absoluteStyles: React.CSSProperties = {
      ...baseStyles,
      position: 'absolute',
    };

    switch (position) {
      case 'top-left':
        return { ...absoluteStyles, top: positionOffset.y, left: positionOffset.x };
      case 'top-right':
        return { ...absoluteStyles, top: positionOffset.y, right: positionOffset.x };
      case 'bottom-left':
        return { ...absoluteStyles, bottom: positionOffset.y, left: positionOffset.x };
      case 'bottom-right':
        return { ...absoluteStyles, bottom: positionOffset.y, right: positionOffset.x };
      default:
        return { ...absoluteStyles, top: positionOffset.y, left: positionOffset.x };
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
