import React, { useRef, useState, useCallback, useEffect } from 'react';
import styles from './HeightAdjustableContainer.module.css';

export interface HeightAdjustableContainerProps {
  children: React.ReactNode;
  className?: string;
  initialHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  onHeightChange?: (height: number) => void;
}

interface DragState {
  isDragging: boolean;
  startY: number;
  startHeight: number;
}

export const HeightAdjustableContainer: React.FC<HeightAdjustableContainerProps> = ({
  children,
  className = '',
  initialHeight = 300,
  minHeight = 200,
  maxHeight = 600,
  onHeightChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(initialHeight);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startY: 0,
    startHeight: 0,
  });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDragState({
      isDragging: true,
      startY: e.clientY,
      startHeight: rect.height,
    });

    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.isDragging || !containerRef.current) return;

    const deltaY = e.clientY - dragState.startY;
    
    // Top border drag: moving up decreases height, moving down increases height
    const newHeight = dragState.startHeight - deltaY;

    // Apply constraints
    const constrainedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

    setHeight(constrainedHeight);
    onHeightChange?.(constrainedHeight);
  }, [dragState, minHeight, maxHeight, onHeightChange]);

  const handleMouseUp = useCallback(() => {
    setDragState(prev => ({ 
      ...prev, 
      isDragging: false 
    }));
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, []);

  // Global mouse events for dragging
  useEffect(() => {
    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState.isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      className={`${styles.heightAdjustableContainer} ${className}`}
      style={{ height: `${height}px` }}
    >
      <div
        className={styles.dragHandle}
        onMouseDown={handleMouseDown}
      />
      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
};
