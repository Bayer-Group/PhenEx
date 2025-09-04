import React, { useEffect, useState } from 'react';
import styles from './CustomScrollbar.module.css';

export interface CustomScrollbarProps {
  targetRef: React.RefObject<HTMLElement>;
}

export const CustomScrollbar: React.FC<CustomScrollbarProps> = ({ targetRef }) => {
  const [scrollInfo, setScrollInfo] = useState({ 
    scrollTop: 0, 
    scrollHeight: 0, 
    clientHeight: 0,
    isScrollable: false 
  });

  const updateScrollInfo = () => {
    const target = targetRef.current;
    console.log('CustomScrollbar: updateScrollInfo called', { target: !!target });
    
    if (!target) {
      console.log('CustomScrollbar: No target element');
      return;
    }

    // Find the scrollable element (AG Grid viewport or the target itself)
    const agGridViewport = target.querySelector('.ag-body-viewport');
    console.log('CustomScrollbar: AG Grid viewport found?', !!agGridViewport);
    
    const scrollableElement = agGridViewport || target;
    
    const scrollTop = scrollableElement.scrollTop;
    const scrollHeight = scrollableElement.scrollHeight;
    const clientHeight = scrollableElement.clientHeight;
    const isScrollable = scrollHeight > clientHeight;

  console.log('CustomScrollbar: Scroll info', {
      scrollTop,
      scrollHeight,
      clientHeight,
      isScrollable,
      element: scrollableElement.tagName,
      className: scrollableElement.className,
      difference: scrollHeight - clientHeight
    });

    setScrollInfo({ scrollTop, scrollHeight, clientHeight, isScrollable });
  };

  const handleScrollbarClick = (e: React.MouseEvent) => {
    const target = targetRef.current;
    if (!target) return;

    const scrollableElement = target.querySelector('.ag-body-viewport') || target;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickRatio = (e.clientY - rect.top) / rect.height;
    
    scrollableElement.scrollTop = clickRatio * (scrollInfo.scrollHeight - scrollInfo.clientHeight);
  };

  useEffect(() => {
    console.log('CustomScrollbar: useEffect called');
    
    const waitForAgGrid = () => {
      const target = targetRef.current;
      if (!target) {
        console.log('CustomScrollbar: No target, retrying...');
        setTimeout(waitForAgGrid, 100);
        return;
      }

      const agGridViewport = target.querySelector('.ag-body-viewport');
      if (!agGridViewport) {
        console.log('CustomScrollbar: No AG Grid viewport yet, retrying...');
        setTimeout(waitForAgGrid, 100);
        return;
      }

      console.log('CustomScrollbar: AG Grid found, setting up scrollbar');
      const scrollableElement = agGridViewport as HTMLElement;
      
      // Hide the default scrollbar directly on the element
      scrollableElement.style.scrollbarWidth = 'none'; // Firefox
      (scrollableElement.style as any).msOverflowStyle = 'none'; // IE and Edge
      
      // Create a style element for webkit scrollbar
      const style = document.createElement('style');
      style.textContent = `
        .ag-body-viewport::-webkit-scrollbar {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
      
      console.log('CustomScrollbar: Setting up scroll listener on', {
        element: scrollableElement.tagName,
        className: scrollableElement.className,
        scrollable: scrollableElement.scrollHeight > scrollableElement.clientHeight,
        scrollHeight: scrollableElement.scrollHeight,
        clientHeight: scrollableElement.clientHeight,
        hasScrollEvent: typeof scrollableElement.addEventListener === 'function'
      });

      const handleScroll = () => {
        console.log('CustomScrollbar: Scroll event triggered!');
        updateScrollInfo();
      };
      
      scrollableElement.addEventListener('scroll', handleScroll);
      
      // Test if the element can be scrolled manually
      setTimeout(() => {
        console.log('CustomScrollbar: Testing manual scroll', {
          currentScrollTop: scrollableElement.scrollTop,
          maxScroll: scrollableElement.scrollHeight - scrollableElement.clientHeight
        });
        if (scrollableElement.scrollHeight > scrollableElement.clientHeight) {
          console.log('CustomScrollbar: Attempting to scroll programmatically');
          scrollableElement.scrollTop = 10;
          setTimeout(() => {
            console.log('CustomScrollbar: After manual scroll:', scrollableElement.scrollTop);
          }, 100);
        }
      }, 1000);
      
      updateScrollInfo(); // Initial update

      return () => {
        scrollableElement.removeEventListener('scroll', handleScroll);
      };
    };

    waitForAgGrid();
  }, [targetRef]);

  // Show scrollbar if there's ANY scroll content (even just 1px) or force show for debugging
  const showScrollbar = scrollInfo.scrollHeight > scrollInfo.clientHeight || true; // Force show for now
  
  if (!showScrollbar) {
    console.log('CustomScrollbar: Not scrollable, returning null');
    return null;
  }

  const thumbHeight = Math.max(20, (scrollInfo.clientHeight / scrollInfo.scrollHeight) * 100);
  const thumbTop = (scrollInfo.scrollTop / (scrollInfo.scrollHeight - scrollInfo.clientHeight)) * (100 - thumbHeight);
  console.log("CustomScrollbar: CREATING SCROLLBAR", { 
    thumbHeight, 
    thumbTop,
    scrollInfo,
    isScrollable: scrollInfo.isScrollable 
  });

  return (
    <div 
      className={styles.scrollbar}
      onClick={handleScrollbarClick}
      style={{ 
        backgroundColor: 'red', // Temporary debug
        border: '2px solid blue' // Temporary debug
      }}
    >
      <div 
        className={styles.thumb}
        style={{
          height: `${thumbHeight}%`,
          top: `${thumbTop}%`,
          backgroundColor: 'yellow' // Temporary debug
        }}
      />
    </div>
  );
};
