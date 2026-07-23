import React, { useEffect, useRef, useState } from 'react';
import styles from './AGGridCustomScrollbar.module.css';

export interface AGGridCustomScrollbarProps {
  targetRef: React.RefObject<HTMLElement>;
  orientation?: 'vertical' | 'horizontal'; // Orientation of the scrollbar
  marginTop?: number; // Top margin in pixels
  marginBottom?: number; // Bottom margin in pixels  
  marginLeft?: number; // Left margin in pixels
  marginRight?: number; // Right margin in pixels
  marginToEnd?: number; // marginRight for vertical, marginBottom for horizontal
  classNameThumb?: string; // Additional class for the thumb
  classNameTrack?: string; // Additional class for the track
  thick?: boolean; // Thick scrollbar mode (horizontal only)
}

export const AGGridCustomScrollbar: React.FC<AGGridCustomScrollbarProps> = ({ 
  targetRef, 
  orientation = 'vertical',
  marginTop = 0,
  marginBottom = 0, 
  marginLeft = 0,
  marginRight = 0,
  marginToEnd = 0,
  classNameThumb = '',
  classNameTrack = '',
  thick = false
}) => {
  // Only isScrollable and isDragging drive React renders; scroll position is handled imperatively
  const [isScrollable, setIsScrollable] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ 
    x: 0, 
    y: 0, 
    scrollTop: 0, 
    scrollLeft: 0,
    scrollHeight: 0,
    scrollWidth: 0,
    clientHeight: 0,
    clientWidth: 0
  });

  // Cached refs — avoid repeated querySelector on every scroll event
  const cachedScrollableRef = useRef<HTMLElement | null>(null);
  const isScrollableRef = useRef(false);
  const thumbRef = useRef<HTMLDivElement>(null);

  // Directly update the thumb element's style — no React re-render on scroll
  // scrollEl: when provided (horizontal scroll events), read position from this element directly
  const updateThumbDirect = (scrollEl?: HTMLElement) => {
    const el = scrollEl || cachedScrollableRef.current;
    const thumb = thumbRef.current;
    if (!el) return;

    // For horizontal, also cache the real scroll element so drag/track handlers use it
    if (scrollEl && orientation === 'horizontal') {
      cachedScrollableRef.current = scrollEl;
    }

    const { scrollTop, scrollLeft, scrollHeight, scrollWidth, clientHeight, clientWidth } = el;
    const nowScrollable = orientation === 'vertical'
      ? scrollHeight > clientHeight
      : scrollWidth > clientWidth;

    if (nowScrollable !== isScrollableRef.current) {
      isScrollableRef.current = nowScrollable;
      setIsScrollable(nowScrollable);
    }

    if (!nowScrollable || !thumb) return;

    if (orientation === 'vertical') {
      const thumbHeight = Math.max(20, (clientHeight / scrollHeight) * 100);
      const thumbTop = scrollHeight > clientHeight
        ? (scrollTop / (scrollHeight - clientHeight)) * (100 - thumbHeight)
        : 0;
      thumb.style.height = `${thumbHeight}%`;
      thumb.style.top = `${thumbTop}%`;
    } else {
      const thumbWidth = Math.max(20, (clientWidth / scrollWidth) * 100);
      const thumbLeft = scrollWidth > clientWidth
        ? (scrollLeft / (scrollWidth - clientWidth)) * (100 - thumbWidth)
        : 0;
      if (thick) {
        thumb.style.width = `calc(${thumbWidth}% - 8px)`;
        thumb.style.left = `calc(4px + ${thumbLeft}%)`;
      } else {
        thumb.style.width = `${thumbWidth}%`;
        thumb.style.left = `${thumbLeft}%`;
      }
    }
  };

  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const scrollableElement = cachedScrollableRef.current;
    if (!scrollableElement) return;

    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      scrollTop: scrollableElement.scrollTop,
      scrollLeft: scrollableElement.scrollLeft,
      scrollHeight: scrollableElement.scrollHeight,
      scrollWidth: scrollableElement.scrollWidth,
      clientHeight: scrollableElement.clientHeight,
      clientWidth: scrollableElement.clientWidth
    });
  };

  const handleTrackMouseDown = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const scrollableElement = cachedScrollableRef.current;
    if (!scrollableElement) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const { scrollHeight, scrollWidth, clientHeight, clientWidth } = scrollableElement;
    
    if (orientation === 'vertical') {
      const clickRatio = (e.clientY - rect.top) / rect.height;
      const newScrollTop = clickRatio * (scrollHeight - clientHeight);
      scrollableElement.scrollTop = Math.max(0, Math.min(scrollHeight - clientHeight, newScrollTop));
    } else {
      const clickRatio = (e.clientX - rect.left) / rect.width;
      const newScrollLeft = clickRatio * (scrollWidth - clientWidth);
      scrollableElement.scrollLeft = Math.max(0, Math.min(scrollWidth - clientWidth, newScrollLeft));
    }
  };

  // Handle global mouse move and mouse up for dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const scrollableElement = cachedScrollableRef.current;
      if (!scrollableElement) return;

      if (orientation === 'vertical') {
        const deltaY = e.clientY - dragStart.y;
        // Use dimensions captured at drag start, not current state
        const trackHeight = dragStart.clientHeight;
        const scrollRange = dragStart.scrollHeight - dragStart.clientHeight;
        const scrollDelta = (deltaY / trackHeight) * scrollRange;
        const newScrollTop = Math.max(0, Math.min(scrollRange, dragStart.scrollTop + scrollDelta));
        
        // Only update if the value actually changed
        if (Math.abs(scrollableElement.scrollTop - newScrollTop) > 0.5) {
          scrollableElement.scrollTop = newScrollTop;
        }
      } else {
        const deltaX = e.clientX - dragStart.x;
        // Use dimensions captured at drag start, not current state
        const trackWidth = dragStart.clientWidth;
        const scrollRange = dragStart.scrollWidth - dragStart.clientWidth;
        const scrollDelta = (deltaX / trackWidth) * scrollRange;
        const newScrollLeft = Math.max(0, Math.min(scrollRange, dragStart.scrollLeft + scrollDelta));
        
        // Only update if the value actually changed
        if (Math.abs(scrollableElement.scrollLeft - newScrollLeft) > 0.5) {
          scrollableElement.scrollLeft = newScrollLeft;
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    // Use capture phase to ensure we get the event first
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseup', handleMouseUp, true);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
    };
  }, [isDragging, dragStart, orientation]);

  useEffect(() => {
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
      
      // Cache the scrollable element to avoid querySelector on every scroll event
      cachedScrollableRef.current = scrollableElement;
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

      const handleScroll = (event: Event) => {
        // For horizontal scrollbar, be very specific about which events to handle
        if (orientation === 'horizontal') {
          const target = event.target as HTMLElement;
          // Only process if this is actually a horizontal scroll container
          if (target && (
            target.classList.contains('ag-body-horizontal-scroll-viewport') ||
            target.classList.contains('ag-center-cols-viewport') ||
            target.classList.contains('ag-center-cols-container') ||
            target.classList.contains('ag-body-horizontal-scroll')
          )) {
            updateThumbDirect(target); // read scrollLeft from the element that actually scrolled
          }
        } else {
          // Vertical scrollbar processes all events normally
          updateThumbDirect();
        }
      };

      // Be more specific about which elements each orientation should listen to
      const elementsToListenTo = [];
      
      if (orientation === 'vertical') {
        // Vertical scrollbar listens ONLY to the main viewport
        const mainViewport = target.querySelector('.ag-body-viewport');
        if (mainViewport) {
          elementsToListenTo.push(mainViewport);
        }
      } else {
        // Horizontal scrollbar should NOT listen to the main viewport
        // Only listen to actual horizontal scroll containers
        if (scrollableElement.classList.contains('ag-body-horizontal-scroll-viewport') ||
            scrollableElement.classList.contains('ag-center-cols-viewport') ||
            scrollableElement.classList.contains('ag-center-cols-container') ||
            scrollableElement.classList.contains('ag-body-horizontal-scroll')) {
          elementsToListenTo.push(scrollableElement);
        }
        
        // Add other horizontal-specific containers, but NOT the main viewport
        const additionalHorizontalContainers = [
          target.querySelector('.ag-center-cols-viewport'),
          target.querySelector('.ag-center-cols-container'),
          target.querySelector('.ag-body-horizontal-scroll')
        ].filter(el => el && el !== scrollableElement && !el.classList.contains('ag-body-viewport'));
        
        elementsToListenTo.push(...additionalHorizontalContainers);
      }
      
      // Remove duplicates
      const uniqueElementsToListenTo = [...new Set(elementsToListenTo)].filter(Boolean);
      
      // Set up observers to detect content changes
      let resizeObserver: ResizeObserver | null = null;
      let mutationObserver: MutationObserver | null = null;
      
      // ResizeObserver to detect size changes
      if (window.ResizeObserver) {
        resizeObserver = new ResizeObserver(() => {
          updateThumbDirect();
        });
        resizeObserver.observe(scrollableElement);
      }
      
      // MutationObserver to detect direct child additions (e.g. new rows) — no subtree to avoid firing on every cell render
      mutationObserver = new MutationObserver(() => {
        requestAnimationFrame(() => {
          updateThumbDirect();
        });
      });
      
      mutationObserver.observe(scrollableElement, {
        childList: true,
        subtree: false,
        attributes: false
      });
      
      // Add scroll listeners to all relevant elements for this orientation
      uniqueElementsToListenTo.forEach(element => {
        if (element) {
          element.addEventListener('scroll', handleScroll);
        }
      });
      
      // Store elements for cleanup
      (scrollableElement as any)._scrollListenerElements = uniqueElementsToListenTo;
      
      updateThumbDirect(); // Initial update

      return () => {
        // Clean up scroll listeners from all elements
        const elementsWithListeners = (scrollableElement as any)._scrollListenerElements || [];
        elementsWithListeners.forEach((element: Element) => {
          if (element) {
            element.removeEventListener('scroll', handleScroll);
          }
        });
        
        // Clean up polling interval for horizontal scrollbar
        const pollInterval = (scrollableElement as any)._pollInterval;
        if (pollInterval) {
          clearInterval(pollInterval);
        }
        
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        if (mutationObserver) {
          mutationObserver.disconnect();
        }
        cachedScrollableRef.current = null;
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

  if (!isScrollable) {
    return null;
  }

  // Track position is static; thumb position is updated imperatively via thumbRef
  let scrollbarStyle: React.CSSProperties;

  if (orientation === 'vertical') {
    scrollbarStyle = {
      top: `${marginTop}px`,
      bottom: `${marginBottom}px`,
      right: `${marginToEnd}px`,
      height: `calc(100% - ${marginTop + marginBottom}px)`,
    };
  } else {
    scrollbarStyle = {
      left: `${marginLeft}px`,
      right: `${marginRight}px`,
      bottom: `${marginToEnd}px`,
      width: `calc(100% - ${marginLeft + marginRight}px)`,
    };
  }

  const scrollbarClass = orientation === 'vertical' 
    ? `${styles.scrollbar} ${isDragging ? styles.dragging : ''} ${classNameTrack}`
    : `${styles.scrollbarHorizontal} ${isDragging ? styles.dragging : ''} ${thick ? styles.thick : ''} ${classNameTrack}`;

  const thumbClass = orientation === 'vertical'
    ? `${styles.thumb} ${classNameThumb}`
    : `${styles.thumb} ${styles.thumbHorizontal} ${classNameThumb}`;

  return (
    <div 
      className={scrollbarClass}
      onMouseDown={handleTrackMouseDown}
      style={scrollbarStyle}
    >
      <div 
        ref={thumbRef}
        className={thumbClass}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleThumbMouseDown}
      />
    </div>
  );
};
