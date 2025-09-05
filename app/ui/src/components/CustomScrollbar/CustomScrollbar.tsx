import React, { useEffect, useState } from 'react';
import styles from './CustomScrollbar.module.css';

export interface CustomScrollbarProps {
  targetRef: React.RefObject<HTMLElement>;
  orientation?: 'vertical' | 'horizontal'; // Orientation of the scrollbar
  height?: string | number; // Height of the scrollbar (e.g. "80%", 300, etc.) - for vertical
  width?: string | number; // Width of the scrollbar (e.g. "80%", 300, etc.) - for horizontal
  marginBottom?: string | number; // Bottom margin (e.g. "10px", 20, etc.) - for vertical
  marginRight?: string | number; // Right margin (e.g. "10px", 20, etc.) - for horizontal
  classNameThumb?: string; // Additional class for the thumb
  classNameTrack?: string; // Additional class for the track
}

export const CustomScrollbar: React.FC<CustomScrollbarProps> = ({ 
  targetRef, 
  orientation = 'vertical',
  height = "85%", 
  width = "85%",
  marginBottom = 20,
  marginRight = 20,
  classNameThumb = '',
  classNameTrack = ''
}) => {
  const [scrollInfo, setScrollInfo] = useState({ 
    scrollTop: 0, 
    scrollHeight: 0, 
    clientHeight: 0,
    isScrollable: false 
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ y: 0, scrollTop: 0 });

  const updateScrollInfo = () => {
    const target = targetRef.current;
    if (!target) return;

    // Find the scrollable element (AG Grid viewport or the target itself)
    const agGridViewport = target.querySelector('.ag-body-viewport');
    const scrollableElement = agGridViewport || target;
    
    const scrollTop = scrollableElement.scrollTop;
    const scrollHeight = scrollableElement.scrollHeight;
    const clientHeight = scrollableElement.clientHeight;
    
    // Test if element can actually scroll by temporarily setting scrollTop
    const originalScrollTop = scrollableElement.scrollTop;
    scrollableElement.scrollTop = 1;
    const canActuallyScroll = scrollableElement.scrollTop > 0;
    scrollableElement.scrollTop = originalScrollTop;
    
    // More precise check - element is scrollable if:
    // 1. scrollHeight > clientHeight AND
    // 2. we can actually scroll (not just padding/margins creating extra height)
    const isScrollable = scrollHeight > clientHeight && canActuallyScroll;

    console.log('updateScrollInfo:', {
      scrollTop,
      scrollHeight,
      clientHeight,
      canActuallyScroll,
      isScrollable,
      heightDiff: scrollHeight - clientHeight,
      elementType: agGridViewport ? 'ag-grid-viewport' : 'target'
    });

    setScrollInfo({ scrollTop, scrollHeight, clientHeight, isScrollable });
  };

  const getScrollableElement = (): HTMLElement | null => {
    const target = targetRef.current;
    if (!target) return null;
    return target.querySelector('.ag-body-viewport') || target;
  };

  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const scrollableElement = getScrollableElement();
    if (!scrollableElement) return;

    setIsDragging(true);
    setDragStart({
      y: e.clientY,
      scrollTop: scrollableElement.scrollTop
    });
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    // Only handle clicks on the track, not the thumb
    if (e.target !== e.currentTarget) return;
    
    const scrollableElement = getScrollableElement();
    if (!scrollableElement) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickRatio = (e.clientY - rect.top) / rect.height;
    scrollableElement.scrollTop = clickRatio * (scrollInfo.scrollHeight - scrollInfo.clientHeight);
  };

  // Handle global mouse move and mouse up for dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const scrollableElement = getScrollableElement();
      if (!scrollableElement) return;

      const deltaY = e.clientY - dragStart.y;
      const scrollRange = scrollInfo.scrollHeight - scrollInfo.clientHeight;
      const thumbRange = 100 - ((scrollInfo.clientHeight / scrollInfo.scrollHeight) * 100);
      const scrollRatio = deltaY / (scrollableElement.clientHeight * (thumbRange / 100));
      
      scrollableElement.scrollTop = dragStart.scrollTop + (scrollRatio * scrollRange);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, scrollInfo]);

  useEffect(() => {
    console.log('CustomScrollbar: useEffect called');
    
    const waitForAgGrid = () => {
      const target = targetRef.current;
      if (!target) {
        setTimeout(waitForAgGrid, 100);
        return;
      }

      // Look for all possible scrollable elements in AG Grid
      const agGridViewport = target.querySelector('.ag-body-viewport');
      
      if (!agGridViewport) {
        setTimeout(waitForAgGrid, 100);
        return;
      }

      const scrollableElement = agGridViewport as HTMLElement;
      
      // Create a unique class name for this specific instance
      const uniqueClass = `custom-scrollbar-hidden-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      scrollableElement.classList.add(uniqueClass);
      
      // Simple CSS approach - the main hiding is handled by PhenotypeViewer CSS
      scrollableElement.style.scrollbarWidth = 'none'; // Firefox
      (scrollableElement.style as any).msOverflowStyle = 'none'; // IE and Edge
      
      // Method 2: CSS injection with multiple selectors
      const style = document.createElement('style');
      style.setAttribute('data-custom-scrollbar', uniqueClass);
      style.textContent = `
        /* Target the specific element */
        .${uniqueClass}::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
          background: transparent !important;
        }
        .${uniqueClass}::-webkit-scrollbar-track {
          display: none !important;
        }
        .${uniqueClass}::-webkit-scrollbar-thumb {
          display: none !important;
        }
        .${uniqueClass} {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        
        /* Also target by AG Grid class + unique class combination */
        .ag-body-viewport.${uniqueClass}::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
        }
        .ag-body-viewport.${uniqueClass} {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
      `;
      document.head.appendChild(style);
      
      // Method 3: Set overflow style to ensure it's scrollable but without visible scrollbar
      scrollableElement.style.overflow = 'scroll';
      scrollableElement.style.setProperty('overflow', 'scroll', 'important');

      const handleScroll = () => {
        updateScrollInfo();
      };
      
      // Set up observers to detect content changes
      let resizeObserver: ResizeObserver | null = null;
      let mutationObserver: MutationObserver | null = null;
      
      // ResizeObserver to detect size changes
      if (window.ResizeObserver) {
        resizeObserver = new ResizeObserver(() => {
          updateScrollInfo();
        });
        resizeObserver.observe(scrollableElement);
      }
      
      // MutationObserver to detect content changes (like new rows in AG Grid)
      mutationObserver = new MutationObserver(() => {
        // Use requestAnimationFrame to avoid excessive calls
        requestAnimationFrame(() => {
          updateScrollInfo();
        });
      });
      
      mutationObserver.observe(scrollableElement, {
        childList: true,
        subtree: true,
        attributes: false
      });
      
      scrollableElement.addEventListener('scroll', handleScroll);
      
      updateScrollInfo(); // Initial update

      return () => {
        scrollableElement.removeEventListener('scroll', handleScroll);
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        if (mutationObserver) {
          mutationObserver.disconnect();
        }
        // Clean up the unique class and style element
        scrollableElement.classList.remove(uniqueClass);
        const styleElement = document.querySelector(`style[data-custom-scrollbar="${uniqueClass}"]`);
        if (styleElement && styleElement.parentNode) {
          styleElement.parentNode.removeChild(styleElement);
        }
      };
    };

    waitForAgGrid();
  }, [targetRef]);

  // Show scrollbar only if content is actually scrollable
  const showScrollbar = scrollInfo.isScrollable;
  
  // Debug logging to understand scroll behavior
  console.log('CustomScrollbar Debug:', {
    scrollHeight: scrollInfo.scrollHeight,
    clientHeight: scrollInfo.clientHeight,
    isScrollable: scrollInfo.isScrollable,
    showScrollbar,
    heightDiff: scrollInfo.scrollHeight - scrollInfo.clientHeight
  });
  
  if (!showScrollbar) {
    return null;
  }

  const thumbHeight = Math.max(20, (scrollInfo.clientHeight / scrollInfo.scrollHeight) * 100);
  const thumbTop = (scrollInfo.scrollTop / (scrollInfo.scrollHeight - scrollInfo.clientHeight)) * (100 - thumbHeight);
  
  // Convert height and marginBottom to CSS values
  const heightValue = typeof height === 'number' ? `${height}px` : height;
  const bottomValue = typeof marginBottom === 'number' ? `${marginBottom}px` : marginBottom;

  return (
    <div 
      className={`${styles.scrollbar} ${isDragging ? styles.dragging : ''} ${classNameTrack}`}
      onClick={handleTrackClick}
      style={{ 
        height: heightValue,
        top: 65,
      }}
    >
      <div 
        className={`${styles.thumb} ${classNameThumb}`}
        style={{
          height: `${thumbHeight}%`,
          top: `${thumbTop}%`,
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onMouseDown={handleThumbMouseDown}
      />
    </div>
  );
};
