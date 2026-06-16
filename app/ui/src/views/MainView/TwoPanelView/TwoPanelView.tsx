import React, { useState } from 'react';
import styles from './TwoPanelView.module.css';
import { Portal } from '../../../components/Portal/Portal';

interface TwoPanelViewProps {
  initialSizeLeft: number;
  minSizeLeft: number;
  minSizeRight?: number;
  maxSizeRight?: number;
  leftContent: React.ReactNode;
  slideoverContent?: React.ReactNode;
  popoverContent?: React.ReactNode;
  collapseButtonTheme?: 'light' | 'dark';
  onSlideoverCollapse?: (isCollapsed: boolean) => void;
  onPopoverClose?: () => void;
  slideoverCollapsed?: boolean;
}

export const TwoPanelView = React.forwardRef<
  { 
    collapseSlideoverPanel: (collapse: boolean) => void;
    showPopover: (content: React.ReactNode) => void;
    hidePopover: () => void;
  },
  TwoPanelViewProps
>((props, ref) => {
  const { 
    initialSizeLeft, 
    minSizeLeft, 
    minSizeRight,
    maxSizeRight, 
    leftContent,
    slideoverContent,
    popoverContent,
    collapseButtonTheme = 'dark', 
    onSlideoverCollapse,
    onPopoverClose,
    slideoverCollapsed
  } = props;

  // Initialize rightWidth with a reasonable default that respects constraints
  const initialRightWidth = React.useMemo(() => {
    try {
      const stored = localStorage.getItem('phenex_two_panel_right_width');
      if (stored) {
        const parsed = parseInt(stored, 10);
        // Respect constraints
        if (minSizeRight && parsed < minSizeRight) return minSizeRight;
        if (maxSizeRight && parsed > maxSizeRight) return maxSizeRight;
        return parsed;
      }
    } catch {
      // Fall through to default
    }
    return minSizeRight || 150;
  }, [minSizeRight, maxSizeRight]);

  const [rightWidth, setRightWidth] = useState(initialRightWidth);
  // leftWidth will be calculated dynamically based on container size
  const [leftWidth, setLeftWidth] = useState(initialSizeLeft);

  // Recalculate leftWidth when container size is available
  React.useEffect(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const calculatedLeftWidth = containerWidth - rightWidth;
      // Respect minSizeLeft constraint
      const finalLeftWidth = minSizeLeft ? Math.max(calculatedLeftWidth, minSizeLeft) : calculatedLeftWidth;
      setLeftWidth(finalLeftWidth);
    }
  }, [rightWidth, minSizeLeft]); // Recalculate when rightWidth changes or constraints change

  React.useEffect(() => {
    try {
      localStorage.setItem('phenex_two_panel_right_width', rightWidth.toString());
    } catch (error) {
      console.warn('Failed to save right width to localStorage:', error);
    }
  }, [rightWidth]);
  const [isSlideoverCollapsed, setIsSlideoverCollapsed] = useState(slideoverCollapsed ?? false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [popoverContentState, setPopoverContentState] = useState<React.ReactNode>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const containerIdRef = React.useRef(`two-panel-container-${Math.random().toString(36).substr(2, 9)}`);

  React.useImperativeHandle(ref, () => ({
    collapseSlideoverPanel: (collapse: boolean) => {
      setIsSlideoverCollapsed(collapse);
      onSlideoverCollapse?.(collapse);
    },
    showPopover: (content: React.ReactNode) => {
      setPopoverContentState(content);
      setIsPopoverOpen(true);
    },
    hidePopover: () => {
      setIsClosing(true);
      setTimeout(() => {
        setIsPopoverOpen(false);
        setIsClosing(false);
        setPopoverContentState(null);
      }, 100);
    },
  }));

  const handleMouseDown = (e: React.MouseEvent) => {
    console.log('[TwoPanelView] handleMouseDown triggered', { target: e.target, classList: (e.target as HTMLElement).classList });
    if ((e.target as HTMLElement).classList.contains(styles.collapseButton)) {
      console.log('[TwoPanelView] Ignoring - collapse button clicked');
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    console.log('[TwoPanelView] Setting isDragging to true');
    setIsDragging(true);
    const container = containerRef.current;
    if (container) {
      container.dataset.dragging = 'true';
      console.log('[TwoPanelView] Container dragging set to true');
    }
  };

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    
    const draggingState = container.dataset.dragging;
    
    if (draggingState !== 'true') {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    console.log('[TwoPanelView] Mouse position:', { 
      clientX: e.clientX, 
      containerLeft: containerRect.left, 
      mouseX,
      containerWidth: container.offsetWidth 
    });
    
    // Slideover is on the right: mouseX is the left edge of the slideover (right edge of main content)
    // leftWidth state = main content width, rightWidth state = slideover width
    let newMainContentWidth = mouseX;
    let newSlideoverWidth = container.offsetWidth - mouseX;
    
    console.log('[TwoPanelView] Before constraints:', { newSlideoverWidth, newMainContentWidth, minSizeRight, maxSizeRight, minSizeLeft });
    
    // Apply constraints: slideover uses minSizeRight/maxSizeRight, main content uses minSizeLeft
    if (minSizeRight) {
      newSlideoverWidth = Math.max(newSlideoverWidth, minSizeRight);
      newMainContentWidth = container.offsetWidth - newSlideoverWidth;
    }
    if (maxSizeRight) {
      newSlideoverWidth = Math.min(newSlideoverWidth, maxSizeRight);
      newMainContentWidth = container.offsetWidth - newSlideoverWidth;
    }
    if (minSizeLeft) {
      newMainContentWidth = Math.max(newMainContentWidth, minSizeLeft);
      newSlideoverWidth = container.offsetWidth - newMainContentWidth;
    }

    setLeftWidth(newMainContentWidth);
    setRightWidth(newSlideoverWidth);
  }, [minSizeLeft, minSizeRight, maxSizeRight]);

  const handleMouseUp = React.useCallback(() => {
    console.log('[TwoPanelView] handleMouseUp called');
    setIsDragging(false);
    const container = containerRef.current;
    if (container) {
      container.dataset.dragging = 'false';
      console.log('[TwoPanelView] Container dragging set to false');
    }
  }, []);

  React.useEffect(() => {
    console.log('[TwoPanelView] isDragging changed:', isDragging);
    if (isDragging) {
      console.log('[TwoPanelView] Adding mousemove and mouseup listeners');
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        console.log('[TwoPanelView] Removing mousemove and mouseup listeners');
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  React.useEffect(() => {
    const observer = new ResizeObserver(() => {
      const container = containerRef.current;
      if (container && !isDragging && !isSlideoverCollapsed) {
        const containerWidth = container.offsetWidth;
        // Keep slideover width fixed so it stays right-justified without jumpiness
        let newLeftWidth = containerWidth - rightWidth;
        if (minSizeLeft != null && newLeftWidth < minSizeLeft) {
          const newRightWidth = containerWidth - minSizeLeft;
          setRightWidth(
            Math.min(maxSizeRight ?? Infinity, Math.max(minSizeRight ?? 0, newRightWidth))
          );
          setLeftWidth(minSizeLeft);
        } else {
          setLeftWidth(newLeftWidth);
        }
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [rightWidth, minSizeLeft, minSizeRight, maxSizeRight, isDragging, isSlideoverCollapsed]);

  return (
    <div
      id={containerIdRef.current}
      ref={containerRef}
      className={`${styles.container} ${styles.vertical}`}
      data-dragging="false"
    >
      <div
        className={`${styles.rightPanel} ${isSlideoverCollapsed ? styles.leftCollapsed : ''}`}
        style={{ width: isSlideoverCollapsed ? '100%' : leftWidth }}
      >
        {leftContent}
      </div>

      {slideoverContent && (
        <>
          <div
            className={`${styles.leftPanel} ${isSlideoverCollapsed ? styles.collapsed : ''}`}
            style={{ width: isSlideoverCollapsed ? 0 : rightWidth }}
          >
            <div
              className={`${styles.divider} ${isSlideoverCollapsed ? styles.collapsed : ''}`}
              onMouseDown={handleMouseDown}
            />
            <div className={styles.leftPanelContent}>{slideoverContent}</div>
          </div>
          <div
            className={`${styles.collapseButton} ${isSlideoverCollapsed ? styles.collapsed : ''}`}
            onClick={() => {
              const newCollapsedState = !isSlideoverCollapsed;
              setIsSlideoverCollapsed(newCollapsedState);
              onSlideoverCollapse?.(newCollapsedState);
            }}
          >
            <span className={styles.collapseButtonIcon}>
              <svg width="25" height="28" viewBox="0 0 25 28" fill="none">
                <path d="M17 25L10.34772 14.0494C10.15571 13.8507 10.16118 13.534 10.35992 13.3422L17 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </span>
          </div>
        </>
      )}
      {(isPopoverOpen || popoverContent) && (
        <Portal>
          <div 
            className={`${styles.popoverOverlay} ${isClosing ? styles.closing : ''}`} 
            onClick={() => {
              setIsClosing(true);
              setTimeout(() => {
                setIsPopoverOpen(false);
                setIsClosing(false);
                onPopoverClose?.();
              }, 100);
            }}
          >
            <div 
              className={`${styles.popoverContent} ${isClosing ? styles.closing : ''}`} 
              onClick={(e) => e.stopPropagation()}
            >
              {/* <div
                className={`${styles.collapseButton} ${collapseButtonTheme === 'light' ? styles.lightTheme : ''}`}
                onClick={() => {
                  setIsClosing(true);
                  setTimeout(() => {
                    setIsPopoverOpen(false);
                    setIsClosing(false);
                    onPopoverClose?.();
                  }, 100);
                }}
              >
                {'—'}
              </div> */}
              <div className={styles.rightPanelContent}>
                {popoverContentState || popoverContent}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
});
