import React, { useEffect, useState, useRef, useCallback } from 'react';
import styles from './SimpleCustomScrollbar.module.css';

export interface SimpleCustomScrollbarProps {
  targetRef: React.RefObject<HTMLElement | null>;
  orientation?: 'vertical' | 'horizontal';
  classNameThumb?: string;
  classNameTrack?: string;
  height?: number | string;
  marginTop?: number | string;
  marginBottom?: number | string;
  marginToEnd?: number; // Right margin for vertical, bottom margin for horizontal
  showOnHover?: boolean; // Only show when the target element is hovered
}

export const SimpleCustomScrollbar: React.FC<SimpleCustomScrollbarProps> = ({
  targetRef,
  orientation = 'vertical',
  classNameThumb = '',
  classNameTrack = '',
  height,
  marginTop = 0,
  marginBottom = 0,
  marginToEnd = 0,
  showOnHover = false,
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
  const [isTargetHovered, setIsTargetHovered] = useState(false);
  const dragRef = useRef({ startY: 0, startX: 0, startScrollTop: 0, startScrollLeft: 0 });
  const trackRef = useRef<HTMLDivElement>(null);

  const updateScrollInfo = useCallback(() => {
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
  }, [targetRef, orientation]);

  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const element = targetRef.current;
    if (!element) return;

    dragRef.current = {
      startY: e.clientY,
      startX: e.clientX,
      startScrollTop: element.scrollTop,
      startScrollLeft: element.scrollLeft,
    };
    setIsDragging(true);
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.target === e.currentTarget) {
      const element = targetRef.current;
      if (!element) return;

      const rect = e.currentTarget.getBoundingClientRect();
      
      if (orientation === 'vertical') {
        const clickY = e.clientY - rect.top;
        const trackHeight = rect.height;
        const scrollRatio = clickY / trackHeight;
        const maxScroll = element.scrollHeight - element.clientHeight;
        element.scrollTop = Math.max(0, Math.min(scrollRatio * maxScroll, maxScroll));
      } else {
        const clickX = e.clientX - rect.left;
        const trackWidth = rect.width;
        const scrollRatio = clickX / trackWidth;
        const maxScroll = element.scrollWidth - element.clientWidth;
        element.scrollLeft = Math.max(0, Math.min(scrollRatio * maxScroll, maxScroll));
      }
    }
  };

  // Mouse move and up handlers
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const element = targetRef.current;
      const track = trackRef.current;
      if (!element || !track) return;

      if (orientation === 'vertical') {
        const deltaY = e.clientY - dragRef.current.startY;
        const scrollableHeight = element.scrollHeight - element.clientHeight;
        const trackHeight = track.getBoundingClientRect().height;
        if (trackHeight === 0 || scrollableHeight === 0) return;
        const thumbRatio = Math.max(20, (element.clientHeight / element.scrollHeight) * 100) / 100;
        const effectiveTrack = trackHeight * (1 - thumbRatio);
        if (effectiveTrack === 0) return;
        const scrollDelta = (deltaY / effectiveTrack) * scrollableHeight;
        const newScrollTop = dragRef.current.startScrollTop + scrollDelta;
        element.scrollTop = Math.max(0, Math.min(newScrollTop, scrollableHeight));
      } else {
        const deltaX = e.clientX - dragRef.current.startX;
        const scrollableWidth = element.scrollWidth - element.clientWidth;
        const trackWidth = track.getBoundingClientRect().width;
        if (trackWidth === 0 || scrollableWidth === 0) return;
        const thumbRatio = Math.max(20, (element.clientWidth / element.scrollWidth) * 100) / 100;
        const effectiveTrack = trackWidth * (1 - thumbRatio);
        if (effectiveTrack === 0) return;
        const scrollDelta = (deltaX / effectiveTrack) * scrollableWidth;
        const newScrollLeft = dragRef.current.startScrollLeft + scrollDelta;
        element.scrollLeft = Math.max(0, Math.min(newScrollLeft, scrollableWidth));
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
  }, [isDragging, orientation, targetRef]);

  // Set up scroll listeners and observers
  useEffect(() => {
    const element = targetRef.current;
    if (!element) return;

    const handleScroll = () => updateScrollInfo();

    // Apply CSS class to hide default scrollbars
    element.classList.add(styles.hideScrollbars);

    // Set up event listeners
    element.addEventListener('scroll', handleScroll);
    
    // Set up ResizeObserver — observe container and all children
    let resizeObserver: ResizeObserver | null = null;
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(updateScrollInfo);
      resizeObserver.observe(element);
      for (const child of Array.from(element.children)) {
        resizeObserver.observe(child);
      }
    }

    // Set up MutationObserver for content changes
    let mutationObserver: MutationObserver | null = null;
    mutationObserver = new MutationObserver((mutations) => {
      // Also observe newly added children
      if (resizeObserver) {
        for (const m of mutations) {
          for (const node of Array.from(m.addedNodes)) {
            if (node instanceof Element) resizeObserver.observe(node);
          }
        }
      }
      requestAnimationFrame(updateScrollInfo);
    });
    mutationObserver.observe(element, {
      childList: true,
      subtree: true
    });

    updateScrollInfo(); // Initial update

    // Hover tracking for showOnHover
    const handleMouseEnter = () => setIsTargetHovered(true);
    const handleMouseLeave = () => setIsTargetHovered(false);
    if (showOnHover) {
      element.addEventListener('mouseenter', handleMouseEnter);
      element.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      element.removeEventListener('scroll', handleScroll);
      element.classList.remove(styles.hideScrollbars);
      if (showOnHover) {
        element.removeEventListener('mouseenter', handleMouseEnter);
        element.removeEventListener('mouseleave', handleMouseLeave);
      }
      
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
    };
  }, [targetRef, orientation, updateScrollInfo, showOnHover]);

  // Calculate thumb size and position
  let scrollbarStyle, thumbStyle;
  
  const toPx = (v: number | string) => typeof v === 'number' ? `${v}px` : v;

  if (orientation === 'vertical') {
    const thumbHeight = Math.max(20, (scrollInfo.clientHeight / scrollInfo.scrollHeight) * 100);
    const thumbTop = (scrollInfo.scrollTop / (scrollInfo.scrollHeight - scrollInfo.clientHeight)) * (100 - thumbHeight);
    
    let computedHeight: string;
    if (height != null) {
      computedHeight = toPx(height);
    } else if (typeof marginTop === 'number' && typeof marginBottom === 'number') {
      computedHeight = scrollInfo.clientHeight > 0
        ? `${scrollInfo.clientHeight - marginTop - marginBottom}px`
        : `calc(100% - ${marginTop + marginBottom}px)`;
    } else {
      computedHeight = `calc(100% - ${toPx(marginTop)} - ${toPx(marginBottom)})`;
    }
    
    scrollbarStyle = {
      height: computedHeight,
      top: marginTop !== 0 ? toPx(marginTop) : undefined,
      bottom: marginTop === 0 && marginBottom !== 0 ? toPx(marginBottom) : undefined,
      right: marginToEnd,
      display: scrollInfo.isScrollable ? 'block' : 'none'
    } as React.CSSProperties;
    
    thumbStyle = {
      height: `${thumbHeight}%`,
      top: `${thumbTop}%`,
      cursor: isDragging ? 'grabbing' : 'grab'
    };
  } else {
    const thumbWidth = Math.max(20, (scrollInfo.clientWidth / scrollInfo.scrollWidth) * 100);
    const thumbLeft = (scrollInfo.scrollLeft / (scrollInfo.scrollWidth - scrollInfo.clientWidth)) * (100 - thumbWidth);
    
    let computedWidth: string;
    if (height != null) {
      computedWidth = toPx(height);
    } else if (typeof marginTop === 'number' && typeof marginToEnd === 'number') {
      computedWidth = scrollInfo.clientWidth > 0
        ? `${scrollInfo.clientWidth - marginTop - marginToEnd}px`
        : `calc(100% - ${marginTop + marginToEnd}px)`;
    } else {
      computedWidth = `calc(100% - ${toPx(marginTop)} - ${toPx(marginToEnd)})`;
    }
    
    scrollbarStyle = {
      width: computedWidth,
      left: marginTop !== 0 ? toPx(marginTop) : undefined,
      bottom: marginToEnd,
      display: scrollInfo.isScrollable ? 'block' : 'none'
    } as React.CSSProperties;
    
    thumbStyle = {
      width: `${thumbWidth}%`,
      left: `${thumbLeft}%`,
      cursor: isDragging ? 'grabbing' : 'grab'
    };
  }

  const [isScrollbarHovered, setIsScrollbarHovered] = useState(false);
  const hoverHidden = showOnHover && !isTargetHovered && !isScrollbarHovered && !isDragging;

  const scrollbarClass = orientation === 'vertical'
    ? `${styles.scrollbar} ${isDragging ? styles.dragging : ''} ${hoverHidden ? styles.hoverHidden : ''} ${classNameTrack}`
    : `${styles.scrollbarHorizontal} ${isDragging ? styles.dragging : ''} ${hoverHidden ? styles.hoverHidden : ''} ${classNameTrack}`;

  const thumbClass = orientation === 'vertical'
    ? `${styles.thumb} ${classNameThumb}`
    : `${styles.thumb} ${styles.thumbHorizontal} ${classNameThumb}`;

  return (
    <div
      ref={trackRef}
      className={scrollbarClass}
      onClick={handleTrackClick}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={() => setIsScrollbarHovered(true)}
      onMouseLeave={() => setIsScrollbarHovered(false)}
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
