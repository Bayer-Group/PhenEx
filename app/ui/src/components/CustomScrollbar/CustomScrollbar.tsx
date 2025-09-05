import React, { useEffect, useState } from 'react';
import styles from './CustomScrollbar.module.css';

export interface CustomScrollbarProps {
  targetRef: React.RefObject<HTMLElement>;
  orientation?: 'vertical' | 'horizontal'; // Orientation of the scrollbar
  height?: string | number; // Height of the scrollbar (e.g. "80%", 300, etc.) - for vertical
  width?: string | number; // Width of the scrollbar (e.g. "80%", 300, etc.) - for horizontal
  classNameThumb?: string; // Additional class for the thumb
  classNameTrack?: string; // Additional class for the track
}

export const CustomScrollbar: React.FC<CustomScrollbarProps> = ({ 
  targetRef, 
  orientation = 'vertical',
  height = "85%", 
  width = "85%",
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
      console.log(`${orientation} scrollbar skipping update - no relevant change`, {
        currentScrollValue,
        previousScrollValue,
        relevantScrollChanged
      });
      return;
    }
    
    console.log(`${orientation} scrollbar updating scroll info`, {
      currentScrollValue,
      previousScrollValue,
      relevantScrollChanged,
      isInitialUpdate
    });
    
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

    // Debug logging for horizontal scrollbar
    if (orientation === 'horizontal') {
      // Get more detailed info about child elements
      const children = Array.from(scrollableElement.children);
      const childWidths = children.map(child => ({
        tagName: child.tagName,
        className: child.className,
        width: child.getBoundingClientRect().width,
        scrollWidth: (child as HTMLElement).scrollWidth
      }));
      
      console.log('CustomScrollbar Horizontal Debug:', {
        orientation,
        scrollLeft,
        scrollWidth,
        clientWidth,
        hasHorizontalOverflow,
        canScrollHorizontally,
        actualCanScrollHorizontally,
        isScrollable,
        element: scrollableElement,
        elementTagName: scrollableElement.tagName,
        elementClasses: scrollableElement.className,
        childWidths,
        elementStyles: {
          overflowX: getComputedStyle(scrollableElement).overflowX,
          width: getComputedStyle(scrollableElement).width,
          display: getComputedStyle(scrollableElement).display
        }
      });
    }

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
      
      console.log('Horizontal scroll element search:', {
        target,
        horizontalScrollViewport,
        allPotentialContainers: allPotentialContainers.map(el => ({
          className: el?.className,
          tagName: el?.tagName,
          scrollWidth: (el as HTMLElement)?.scrollWidth,
          clientWidth: (el as HTMLElement)?.clientWidth,
          overflowX: el ? getComputedStyle(el).overflowX : 'unknown',
          hasHorizontalScroll: (el as HTMLElement)?.scrollWidth > (el as HTMLElement)?.clientWidth
        }))
      });
      
      // Find the element that actually has horizontal overflow
      const actualHorizontalContainer = allPotentialContainers.find(el => {
        if (!el) return false;
        const htmlEl = el as HTMLElement;
        return htmlEl.scrollWidth > htmlEl.clientWidth;
      });
      
      console.log('Found actual horizontal container:', {
        element: actualHorizontalContainer,
        className: actualHorizontalContainer?.className,
        scrollWidth: (actualHorizontalContainer as HTMLElement)?.scrollWidth,
        clientWidth: (actualHorizontalContainer as HTMLElement)?.clientWidth
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
        const scrollRange = scrollInfo.scrollHeight - scrollInfo.clientHeight;
        const thumbRange = 100 - ((scrollInfo.clientHeight / scrollInfo.scrollHeight) * 100);
        const scrollRatio = deltaY / (scrollableElement.clientHeight * (thumbRange / 100));
        
        scrollableElement.scrollTop = dragStart.scrollTop + (scrollRatio * scrollRange);
      } else {
        const deltaX = e.clientX - dragStart.x;
        const scrollRange = scrollInfo.scrollWidth - scrollInfo.clientWidth;
        const thumbRange = 100 - ((scrollInfo.clientWidth / scrollInfo.scrollWidth) * 100);
        const scrollRatio = deltaX / (scrollableElement.clientWidth * (thumbRange / 100));
        
        scrollableElement.scrollLeft = dragStart.scrollLeft + (scrollRatio * scrollRange);
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
        console.log(`Scroll event received for ${orientation} scrollbar from`, event.target);
        
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
            console.log(`Processing horizontal scroll event from ${target.className}`);
            updateScrollInfo();
          } else {
            console.log(`Ignoring scroll event from ${target?.className} for horizontal scrollbar`);
          }
        } else {
          // Vertical scrollbar processes all events normally
          updateScrollInfo();
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
      
      console.log(`Setting up scroll listeners for ${orientation}:`, {
        orientation,
        scrollableElement: scrollableElement.className,
        elementsToListenTo: uniqueElementsToListenTo.map(el => el?.className || 'unknown'),
        totalListeners: uniqueElementsToListenTo.length
      });
      
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
          console.log(`Added scroll listener to ${element.className} for ${orientation}`);
        }
      });
      
      // Store elements for cleanup
      (scrollableElement as any)._scrollListenerElements = uniqueElementsToListenTo;
      
      updateScrollInfo(); // Initial update

      return () => {
        // Clean up scroll listeners from all elements
        const elementsWithListeners = (scrollableElement as any)._scrollListenerElements || [];
        elementsWithListeners.forEach((element: Element) => {
          if (element) {
            element.removeEventListener('scroll', handleScroll);
            console.log(`Removed scroll listener from ${element.className} for ${orientation}`);
          }
        });
        
        // Clean up polling interval for horizontal scrollbar
        const pollInterval = (scrollableElement as any)._pollInterval;
        if (pollInterval) {
          clearInterval(pollInterval);
          console.log(`Cleared polling interval for ${orientation} scrollbar`);
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
  
  // TEMPORARY: Force horizontal scrollbar to be visible for debugging
  const forceShowHorizontal = orientation === 'horizontal';
  const actualShowScrollbar = showScrollbar || forceShowHorizontal;
  
  // Debug logging for rendering
  if (orientation === 'horizontal') {
    console.log('CustomScrollbar Horizontal Render Debug:', {
      orientation,
      showScrollbar,
      forceShowHorizontal,
      actualShowScrollbar,
      scrollInfo,
      willRender: actualShowScrollbar
    });
  }
  
  if (!actualShowScrollbar) {
    return null;
  }

  // Calculate thumb size and position based on orientation
  let scrollbarStyle, thumbStyle;
  
  if (orientation === 'vertical') {
    const thumbHeight = Math.max(20, (scrollInfo.clientHeight / scrollInfo.scrollHeight) * 100);
    const thumbTop = (scrollInfo.scrollTop / (scrollInfo.scrollHeight - scrollInfo.clientHeight)) * (100 - thumbHeight);
    
    // Convert height and marginBottom to CSS values
    const heightValue = typeof height === 'number' ? `${height}px` : height;
    
    scrollbarStyle = { 
      height: heightValue,
      top: 65,
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
    
    // Convert width to CSS value
    const widthValue = typeof width === 'number' ? `${width}px` : width;
    
    scrollbarStyle = { 
      width: widthValue,
      left: 0,
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

  return (
    <div 
      className={scrollbarClass}
      onClick={handleTrackClick}
      style={scrollbarStyle}
    >
      <div 
        className={`${styles.thumb} ${classNameThumb}`}
        style={thumbStyle}
        onMouseDown={handleThumbMouseDown}
      />
    </div>
  );
};
