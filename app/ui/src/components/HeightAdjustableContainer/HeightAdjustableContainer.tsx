import React, { useRef, useCallback } from 'react';
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
  const dragStateRef = useRef<DragState>({
    isDragging: false,
    startY: 0,
    startHeight: 0,
  });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragStateRef.current = {
      isDragging: true,
      startY: e.clientY,
      startHeight: rect.height,
    };

    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragStateRef.current.isDragging || !containerRef.current) return;

    const deltaY = e.clientY - dragStateRef.current.startY;
    
    // Top border drag: moving up decreases height, moving down increases height
    const newHeight = dragStateRef.current.startHeight - deltaY;

    // Apply constraints
    const constrainedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

    // Update the DOM directly - no React state, no re-renders
    containerRef.current.style.height = `${constrainedHeight}px`;
  }, [minHeight, maxHeight]);

  const handleMouseUp = useCallback(() => {
    dragStateRef.current.isDragging = false;
    
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // Only call callback if provided, but don't trigger React re-render
    if (onHeightChange && containerRef.current) {
      const finalHeight = containerRef.current.offsetHeight;
      onHeightChange(finalHeight);
    }
  }, [onHeightChange, handleMouseMove]);

  return (
    <div
      ref={containerRef}
      className={`${styles.heightAdjustableContainer} ${className}`}
      style={{ height: `${initialHeight}px` }}
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
