import React, { useEffect, useState } from 'react';
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
  classNameTrack = ''
}) => {
  const [scrollInfo, setScrollInfo] = useState({ 
    scrollTop: 0, 
    scrollLeft: 0,
    scrollHeight: 0, 
    scrollWidth: 0,
    clientHeight: 0,
    clientWidth: 0,
    isScrollable: false 
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ 
    x: 0, 
    y: 0, 
    scrollTop: 0, 
    scrollLeft: 0 
  });

  const updateScrollInfo = () => {
    const target = targetRef.current;
    if (!target) return;

    // Use the getScrollableElement function to find the correct element for each orientation
    const scrollableElement = getScrollableElement();
    if (!scrollableElement) return;
    
    const scrollTop = scrollableElement.scrollTop;
    const scrollLeft = scrollableElement.scrollLeft;
    const scrollHeight = scrollableElement.scrollHeight;
    const scrollWidth = scrollableElement.scrollWidth;
    const clientHeight = scrollableElement.clientHeight;
    const clientWidth = scrollableElement.clientWidth;
    
    // Check if this scroll change is relevant to this scrollbar's orientation
    const currentScrollValue = orientation === 'vertical' ? scrollTop : scrollLeft;
    const previousScrollValue = orientation === 'vertical' ? scrollInfo.scrollTop : scrollInfo.scrollLeft;
    
    // Only proceed with update if the relevant scroll value changed, or if this is the initial update
    const isInitialUpdate = scrollInfo.scrollTop === 0 && scrollInfo.scrollLeft === 0 && 
                           scrollInfo.scrollHeight === 0 && scrollInfo.scrollWidth === 0;
    const relevantScrollChanged = currentScrollValue !== previousScrollValue;
    
    if (!isInitialUpdate && !relevantScrollChanged) {
      // This scroll event doesn't affect this scrollbar, skip the update
      return;
    }
    
    // Test if element can actually scroll by temporarily setting scroll position
    const originalScrollTop = scrollableElement.scrollTop;
    const originalScrollLeft = scrollableElement.scrollLeft;
    
    // Test vertical scrolling
    scrollableElement.scrollTop = 1;
    const canScrollVertically = scrollableElement.scrollTop > 0;
    scrollableElement.scrollTop = originalScrollTop;
    
    // Test horizontal scrolling  
    scrollableElement.scrollLeft = 1;
    const canScrollHorizontally = scrollableElement.scrollLeft > 0;
    scrollableElement.scrollLeft = originalScrollLeft;
    
    // For horizontal scrolling, also check if there are child elements that extend beyond the container
    const hasHorizontalOverflow = scrollWidth > clientWidth;
    const actualCanScrollHorizontally = canScrollHorizontally || hasHorizontalOverflow;
    
    // Determine if scrollable based on orientation
    const isScrollable = orientation === 'vertical' 
      ? scrollHeight > clientHeight && canScrollVertically
      : actualCanScrollHorizontally;

    // Removed excessive debug logging - keeping component lightweight
    setScrollInfo({ 
      scrollTop, 
      scrollLeft, 
      scrollHeight, 
      scrollWidth, 
      clientHeight, 
      clientWidth, 
      isScrollable 
    });
  };

  const getScrollableElement = () => {
    const target = targetRef.current;
    if (!target) return null;
    
    if (orientation === 'horizontal') {
      // For horizontal scrolling, AG Grid uses different containers
      // Try to find the horizontal scroll container
      const horizontalScrollViewport = target.querySelector('.ag-body-horizontal-scroll-viewport') ||
                                     target.querySelector('.ag-body-horizontal-scroll') ||
                                     target.querySelector('.ag-center-cols-viewport') ||
                                     target.querySelector('.ag-center-cols-container');
      
      // Get ALL elements that might be horizontal scroll containers
      const allPotentialContainers = [
        target.querySelector('.ag-body-horizontal-scroll-viewport'),
        target.querySelector('.ag-body-horizontal-scroll'),
        target.querySelector('.ag-center-cols-viewport'),
        target.querySelector('.ag-center-cols-container'),
        target.querySelector('.ag-body-viewport'), // Sometimes this handles horizontal too
        ...Array.from(target.querySelectorAll('[class*="horizontal"]')),
        ...Array.from(target.querySelectorAll('[class*="center-cols"]'))
      ].filter(Boolean);
      
      // Find the element that actually has horizontal overflow
      const actualHorizontalContainer = allPotentialContainers.find(el => {
        if (!el) return false;
        const htmlEl = el as HTMLElement;
        return htmlEl.scrollWidth > htmlEl.clientWidth;
      });
      
      return actualHorizontalContainer || horizontalScrollViewport || target.querySelector('.ag-body-viewport') || target;
    } else {
      // For vertical scrolling, use the main viewport
      return target.querySelector('.ag-body-viewport') || target;
    }
  };  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const scrollableElement = getScrollableElement();
    if (!scrollableElement) return;

    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      scrollTop: scrollableElement.scrollTop,
      scrollLeft: scrollableElement.scrollLeft
    });
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    // Only handle clicks on the track, not the thumb
    if (e.target !== e.currentTarget) return;
    
    const scrollableElement = getScrollableElement();
    if (!scrollableElement) return;

    const rect = e.currentTarget.getBoundingClientRect();
    
    if (orientation === 'vertical') {
      const clickRatio = (e.clientY - rect.top) / rect.height;
      scrollableElement.scrollTop = clickRatio * (scrollInfo.scrollHeight - scrollInfo.clientHeight);
    } else {
      const clickRatio = (e.clientX - rect.left) / rect.width;
      scrollableElement.scrollLeft = clickRatio * (scrollInfo.scrollWidth - scrollInfo.clientWidth);
    }
  };

  // Handle global mouse move and mouse up for dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const scrollableElement = getScrollableElement();
      if (!scrollableElement) return;

      if (orientation === 'vertical') {
        const deltaY = e.clientY - dragStart.y;
        const trackHeight = scrollInfo.clientHeight;
        const scrollRange = scrollInfo.scrollHeight - scrollInfo.clientHeight;
        const scrollDelta = (deltaY / trackHeight) * scrollRange;
        scrollableElement.scrollTop = Math.max(0, Math.min(scrollRange, dragStart.scrollTop + scrollDelta));
      } else {
        const deltaX = e.clientX - dragStart.x;
        const trackWidth = scrollInfo.clientWidth;
        const scrollRange = scrollInfo.scrollWidth - scrollInfo.clientWidth;
        const scrollDelta = (deltaX / trackWidth) * scrollRange;
        scrollableElement.scrollLeft = Math.max(0, Math.min(scrollRange, dragStart.scrollLeft + scrollDelta));
      }
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
            updateScrollInfo();
          }
        } else {
          // Vertical scrollbar processes all events normally
          updateScrollInfo();
        }
      };

      // Keyboard modifier handler for horizontal scrolling
      const handleWheelWithModifiers = (event: WheelEvent) => {
        // Only handle for horizontal scrollbar
        if (orientation !== 'horizontal') return;
        
        // Shift + scroll - convert vertical scrolling to horizontal
        if (event.shiftKey) {
          
          
          event.preventDefault();
          event.stopPropagation();
          
          const horizontalScrollElement = getScrollableElement();
          
          if (horizontalScrollElement) {
            // Use different scroll amount calculation for better mouse wheel support
            let scrollAmount;
            
            // Check if this is a mouse wheel (typically has larger, discrete values) vs trackpad (smaller, continuous values)
            const isMouseWheel = Math.abs(event.deltaY) > 10 || Math.abs(event.deltaX) > 10 || event.deltaMode === 1; // DOM_DELTA_LINE
            
            // Use deltaX if available (many systems put Shift+scroll horizontal movement in deltaX)
            // Otherwise fall back to deltaY
            const deltaValue = event.deltaX !== 0 ? event.deltaX : event.deltaY;
            
            if (isMouseWheel) {
              // For mouse wheels, use a larger multiplier and normalize the values
              scrollAmount = deltaValue > 0 ? 50 : deltaValue < 0 ? -50 : 0; // Fixed scroll amount for mouse wheels
            } else {
              // For trackpads, use the delta value directly with multiplier
              scrollAmount = deltaValue * 3;
            }
            

            
            const currentScrollLeft = horizontalScrollElement.scrollLeft;
            const maxScrollLeft = horizontalScrollElement.scrollWidth - horizontalScrollElement.clientWidth;
            const newScrollLeft = Math.max(0, Math.min(maxScrollLeft, currentScrollLeft + scrollAmount));
            

            
            horizontalScrollElement.scrollLeft = newScrollLeft;
            
            // Update scroll info immediately
            updateScrollInfo();
          }
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
      
      // Add scroll listeners to all relevant elements for this orientation
      uniqueElementsToListenTo.forEach(element => {
        if (element) {
          element.addEventListener('scroll', handleScroll);
        }
      });
      
      // Add wheel event listener for horizontal scrollbar keyboard modifiers
      if (orientation === 'horizontal') {
        target.addEventListener('wheel', handleWheelWithModifiers, { passive: false });
      }
      
      // Store elements for cleanup
      (scrollableElement as any)._scrollListenerElements = uniqueElementsToListenTo;
      
      updateScrollInfo(); // Initial update

      return () => {
        // Clean up scroll listeners from all elements
        const elementsWithListeners = (scrollableElement as any)._scrollListenerElements || [];
        elementsWithListeners.forEach((element: Element) => {
          if (element) {
            element.removeEventListener('scroll', handleScroll);
          }
        });
        
        // Clean up wheel event listener for horizontal scrollbar
        if (orientation === 'horizontal') {
          target.removeEventListener('wheel', handleWheelWithModifiers);
        }
        
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
  
  if (!showScrollbar) {
    return null;
  }

  // Calculate thumb size and position based on orientation
  let scrollbarStyle, thumbStyle;
  
  if (orientation === 'vertical') {
    const thumbHeight = Math.max(20, (scrollInfo.clientHeight / scrollInfo.scrollHeight) * 100);
    const thumbTop = (scrollInfo.scrollTop / (scrollInfo.scrollHeight - scrollInfo.clientHeight)) * (100 - thumbHeight);
    
    scrollbarStyle = { 
      top: `${marginTop}px`,
      bottom: `${marginBottom}px`,
      right: `${marginToEnd}px`,
      height: `calc(100% - ${marginTop + marginBottom}px)`,
    };
    
    thumbStyle = {
      height: `${thumbHeight}%`,
      top: `${thumbTop}%`,
      cursor: isDragging ? 'grabbing' : 'grab'
    };
  } else {
    // Horizontal orientation
    const thumbWidth = Math.max(20, (scrollInfo.clientWidth / scrollInfo.scrollWidth) * 100);
    const thumbLeft = (scrollInfo.scrollLeft / (scrollInfo.scrollWidth - scrollInfo.clientWidth)) * (100 - thumbWidth);
    
    scrollbarStyle = { 
      left: `${marginLeft}px`,
      right: `${marginRight}px`,
      bottom: `${marginToEnd}px`,
      width: `calc(100% - ${marginLeft + marginRight}px)`,
    };
    
    thumbStyle = {
      width: `${thumbWidth}%`,
      left: `${thumbLeft}%`,
      cursor: isDragging ? 'grabbing' : 'grab'
    };
  }

  const scrollbarClass = orientation === 'vertical' 
    ? `${styles.scrollbar} ${isDragging ? styles.dragging : ''} ${classNameTrack}`
    : `${styles.scrollbarHorizontal} ${isDragging ? styles.dragging : ''} ${classNameTrack}`;

  const thumbClass = orientation === 'vertical'
    ? `${styles.thumb} ${classNameThumb}`
    : `${styles.thumb} ${styles.thumbHorizontal} ${classNameThumb}`;

  return (
    <div 
      className={scrollbarClass}
      onClick={handleTrackClick}
      style={scrollbarStyle}
    >
      <div 
        className={thumbClass}
        style={thumbStyle}
        onMouseDown={handleThumbMouseDown}
      />
    </div>
  );
};
