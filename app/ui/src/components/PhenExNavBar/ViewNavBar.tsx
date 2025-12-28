import React, { useState, useRef } from 'react';
import styles from './NavBar.module.css';

interface ViewNavBarProps {
  height: number;
  scrollPercentage?: number; // Controlled scroll percentage
  canScrollLeft?: boolean;
  canScrollRight?: boolean;
  onViewNavigationArrowClicked?: (direction: 'left' | 'right') => void;
  onViewNavigationScroll?: (percentage: number) => void;
  onViewNavigationVisibilityClicked?: () => void;
}

export const ViewNavBar: React.FC<ViewNavBarProps> = ({
  height,
  scrollPercentage = 0,
  canScrollLeft = true,
  canScrollRight = true,
  onViewNavigationArrowClicked,
  onViewNavigationScroll,
  onViewNavigationVisibilityClicked,
}) => {
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
    
    onViewNavigationScroll?.(percentage);
  };
  
  const renderArrows = () => {
    return (

    <div className={styles.navArrowsContainer}>
        <button
            className={styles.navArrowButton}
            onClick={() => onViewNavigationArrowClicked?.('left')}
            disabled={!canScrollLeft}
            title="Navigate left"
            style={{ opacity: canScrollLeft ? 1 : 0.3, cursor: canScrollLeft ? 'pointer' : 'not-allowed' }}
        >
            <svg width="25" height="28" viewBox="0 0 25 28" fill="none">
              <path d="M17 23L8.34772 14.0494C8.15571 13.8507 8.16118 13.534 8.35992 13.3422L17 5" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            </svg>
        </button>

        <button
            className={styles.navArrowButton}
            onClick={() => onViewNavigationArrowClicked?.('right')}
            disabled={!canScrollRight}
            title="Navigate right"
            style={{ opacity: canScrollRight ? 1 : 0.3, cursor: canScrollRight ? 'pointer' : 'not-allowed' }}
        >
            <svg width="25" height="28" viewBox="0 0 25 28" fill="none" style={{ transform: 'rotate(180deg)' }}>
              <path d="M17 23L8.34772 14.0494C8.15571 13.8507 8.16118 13.534 8.35992 13.3422L17 5" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            </svg>
        </button>
    </div>
    );

    };

  return (
    <div className={`${styles.navBar} `} style={{ height: `${height}px` , marginTop: `${0}px`}}>
      <div className={styles.viewNavContent}>


       {renderArrows()}
        
        <div className={styles.horizontalScrollContainer}>
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
        </div>
        
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
