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
    // Start at minSizeRight if available, otherwise 150px as a narrow default
    return minSizeRight || 150;
  }, [minSizeRight]);

  const [leftWidth, setLeftWidth] = useState(initialSizeLeft);
  const [rightWidth, setRightWidth] = useState(initialRightWidth);
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
    
    // Calculate widths: mouseX is the right edge of the left panel (slideover)
    // leftWidth state = right panel (main content) width
    // rightWidth state = left panel (slideover) width
    let newSlideoverWidth = mouseX;
    let newMainContentWidth = container.offsetWidth - mouseX;
    
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
    
    console.log('[TwoPanelView] After constraints - Setting widths:', { 
      leftWidth: newMainContentWidth, 
      rightWidth: newSlideoverWidth 
    });
    setLeftWidth(newMainContentWidth);   // right panel (main content)
    setRightWidth(newSlideoverWidth);     // left panel (slideover)
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
        const newRightWidth = Math.max(
          200,
          containerWidth * (rightWidth / (leftWidth + rightWidth))
        );
        const newLeftWidth = containerWidth - newRightWidth;
        setLeftWidth(newLeftWidth);
        setRightWidth(newRightWidth);
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [leftWidth, rightWidth, isDragging, isSlideoverCollapsed]);

  return (
    <div
      id={containerIdRef.current}
      ref={containerRef}
      className={`${styles.container} ${styles.vertical}`}
      data-dragging="false"
    >
      {slideoverContent && (
        <div
          className={`${styles.leftPanel} ${isSlideoverCollapsed ? styles.collapsed : ''}`}
          style={{ width: isSlideoverCollapsed ? 0 : rightWidth }}
        >

          <div className={styles.leftPanelContent}>{slideoverContent}</div>
          <div
            className={`${styles.divider} ${isSlideoverCollapsed ? styles.collapsed : ''}`}
            onMouseDown={handleMouseDown}
          ></div>
        </div>
      )}

      

      <div 
        className={`${styles.rightPanel} ${isSlideoverCollapsed ? styles.leftCollapsed : ''}`} 
        style={{ width: isSlideoverCollapsed ? '100%' : leftWidth }}
      >
        {leftContent}
      </div>

          <div
            className={`${styles.collapseButton}`}
            onClick={() => {
              const newCollapsedState = !isSlideoverCollapsed;
              setIsSlideoverCollapsed(newCollapsedState);
              onSlideoverCollapse?.(newCollapsedState);
            }}
          >
            {'—'}
          </div>
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
