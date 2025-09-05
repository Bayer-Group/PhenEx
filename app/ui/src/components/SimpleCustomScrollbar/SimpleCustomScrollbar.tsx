import React, { useEffect, useState } from 'react';
import styles from './SimpleCustomScrollbar.module.css';

export interface SimpleCustomScrollbarProps {
  targetRef: React.RefObject<HTMLElement | null>;
  orientation?: 'vertical' | 'horizontal';
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  classNameThumb?: string;
  classNameTrack?: string;
}

export const SimpleCustomScrollbar: React.FC<SimpleCustomScrollbarProps> = ({
  targetRef,
  orientation = 'vertical',
  marginTop = 0,
  marginBottom = 0,
  marginLeft = 0,
  marginRight = 0,
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
    const element = targetRef.current;
    if (!element) return;

    const scrollTop = element.scrollTop;
    const scrollLeft = element.scrollLeft;
    const scrollHeight = element.scrollHeight;
    const scrollWidth = element.scrollWidth;
    const clientHeight = element.clientHeight;
    const clientWidth = element.clientWidth;

    const isScrollable = orientation === 'vertical'
      ? scrollHeight > clientHeight
      : scrollWidth > clientWidth;

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

  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const element = targetRef.current;
    if (!element) return;

    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      scrollTop: element.scrollTop,
      scrollLeft: element.scrollLeft
    });
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      const element = targetRef.current;
      if (!element) return;

      const rect = e.currentTarget.getBoundingClientRect();
      
      if (orientation === 'vertical') {
        const clickY = e.clientY - rect.top;
        const trackHeight = rect.height;
        const scrollRatio = clickY / trackHeight;
        const newScrollTop = scrollRatio * (scrollInfo.scrollHeight - scrollInfo.clientHeight);
        element.scrollTop = Math.max(0, Math.min(newScrollTop, scrollInfo.scrollHeight - scrollInfo.clientHeight));
      } else {
        const clickX = e.clientX - rect.left;
        const trackWidth = rect.width;
        const scrollRatio = clickX / trackWidth;
        const newScrollLeft = scrollRatio * (scrollInfo.scrollWidth - scrollInfo.clientWidth);
        element.scrollLeft = Math.max(0, Math.min(newScrollLeft, scrollInfo.scrollWidth - scrollInfo.clientWidth));
      }
    }
  };

  // Mouse move and up handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const element = targetRef.current;
      if (!element) return;

      if (orientation === 'vertical') {
        const deltaY = e.clientY - dragStart.y;
        const scrollRange = scrollInfo.scrollHeight - scrollInfo.clientHeight;
        const thumbRange = 100 - ((scrollInfo.clientHeight / scrollInfo.scrollHeight) * 100);
        const effectiveTrackHeight = scrollInfo.clientHeight - marginTop - marginBottom;
        const scrollRatio = deltaY / (effectiveTrackHeight * (thumbRange / 100));
        
        const newScrollTop = dragStart.scrollTop + (scrollRatio * scrollRange);
        element.scrollTop = Math.max(0, Math.min(newScrollTop, scrollRange));
      } else {
        const deltaX = e.clientX - dragStart.x;
        const scrollRange = scrollInfo.scrollWidth - scrollInfo.clientWidth;
        const thumbRange = 100 - ((scrollInfo.clientWidth / scrollInfo.scrollWidth) * 100);
        const effectiveTrackWidth = scrollInfo.clientWidth - marginLeft - marginRight;
        const scrollRatio = deltaX / (effectiveTrackWidth * (thumbRange / 100));
        
        const newScrollLeft = dragStart.scrollLeft + (scrollRatio * scrollRange);
        element.scrollLeft = Math.max(0, Math.min(newScrollLeft, scrollRange));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart, scrollInfo, orientation, targetRef, marginTop, marginBottom, marginLeft, marginRight]);

  // Set up scroll listeners and observers
  useEffect(() => {
    const element = targetRef.current;
    if (!element) return;

    const handleScroll = () => updateScrollInfo();

    // Apply CSS class to hide default scrollbars
    element.classList.add(styles.hideScrollbars);

    // Set up event listeners
    element.addEventListener('scroll', handleScroll);
    
    // Set up ResizeObserver
    let resizeObserver: ResizeObserver | null = null;
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(updateScrollInfo);
      resizeObserver.observe(element);
    }

    // Set up MutationObserver for content changes
    let mutationObserver: MutationObserver | null = null;
    mutationObserver = new MutationObserver(() => {
      requestAnimationFrame(updateScrollInfo);
    });
    mutationObserver.observe(element, {
      childList: true,
      subtree: true
    });

    updateScrollInfo(); // Initial update

    return () => {
      element.removeEventListener('scroll', handleScroll);
      element.classList.remove(styles.hideScrollbars);
      
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
    };
  }, [targetRef, orientation]);

  // Calculate thumb size and position
  let scrollbarStyle, thumbStyle;
  
  if (orientation === 'vertical') {
    const thumbHeight = Math.max(20, (scrollInfo.clientHeight / scrollInfo.scrollHeight) * 100);
    const thumbTop = (scrollInfo.scrollTop / (scrollInfo.scrollHeight - scrollInfo.clientHeight)) * (100 - thumbHeight);
    
    scrollbarStyle = {
      top: `${marginTop}px`,
      height: `calc(100% - ${marginTop + marginBottom}px)`,
      display: scrollInfo.isScrollable ? 'block' : 'none'
    };
    
    thumbStyle = {
      height: `${thumbHeight}%`,
      top: `${thumbTop}%`,
      cursor: isDragging ? 'grabbing' : 'grab'
    };
  } else {
    const thumbWidth = Math.max(20, (scrollInfo.clientWidth / scrollInfo.scrollWidth) * 100);
    const thumbLeft = (scrollInfo.scrollLeft / (scrollInfo.scrollWidth - scrollInfo.clientWidth)) * (100 - thumbWidth);
    
    scrollbarStyle = {
      left: `${marginLeft}px`,
      width: `calc(100% - ${marginLeft + marginRight}px)`,
      display: scrollInfo.isScrollable ? 'block' : 'none'
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
