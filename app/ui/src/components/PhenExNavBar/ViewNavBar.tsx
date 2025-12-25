import React, { useState, useRef } from 'react';
import styles from './NavBar.module.css';

interface ViewNavBarProps {
  height: number;
  onViewNavigationArrowClicked?: (direction: 'left' | 'right') => void;
  onViewNavigationScroll?: (percentage: number) => void;
  onViewNavigationVisibilityClicked?: () => void;
}

export const ViewNavBar: React.FC<ViewNavBarProps> = ({
  height,
  onViewNavigationArrowClicked,
  onViewNavigationScroll,
  onViewNavigationVisibilityClicked,
}) => {
  const [scrollPercentage, setScrollPercentage] = useState(0);
  const scrollBarRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    updateScrollPosition(e);
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (isDraggingRef.current) {
        updateScrollPosition(moveEvent as any);
      }
    };
    
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const updateScrollPosition = (e: React.MouseEvent | MouseEvent) => {
    if (!scrollBarRef.current) return;
    
    const rect = scrollBarRef.current.getBoundingClientRect();
    const x = (e as MouseEvent).clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    
    setScrollPercentage(percentage);
    onViewNavigationScroll?.(percentage);
  };

  return (
    <div className={styles.navBar} style={{ height: `${height}px` }}>
      <div className={styles.viewNavContent}>
        <button
          className={styles.navArrowButton}
          onClick={() => onViewNavigationArrowClicked?.('left')}
          title="Navigate left"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M10 12L6 8l4-4v8z" />
          </svg>
        </button>
        
        <div
          ref={scrollBarRef}
          className={styles.horizontalScrollbar}
          onMouseDown={handleMouseDown}
        >
          <div
            className={styles.scrollbarThumb}
            style={{ left: `${scrollPercentage}%` }}
          />
        </div>
        
        <button
          className={styles.navArrowButton}
          onClick={() => onViewNavigationArrowClicked?.('right')}
          title="Navigate right"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6 4l4 4-4 4V4z" />
          </svg>
        </button>
        
        <button
          className={styles.eyeButton}
          onClick={() => onViewNavigationVisibilityClicked?.()}
          title="Toggle visibility"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </div>
  );
};
