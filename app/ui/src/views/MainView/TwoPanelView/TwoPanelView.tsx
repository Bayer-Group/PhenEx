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

  const [leftWidth, setLeftWidth] = useState(initialSizeLeft);
  const [rightWidth, setRightWidth] = useState(300);
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
    
    // Calculate left panel width based on mouse position
    let newLeftWidth = Math.max(minSizeLeft, mouseX - 10); // -10 accounts for divider position
    let newRightWidth = container.offsetWidth - newLeftWidth;
    
    console.log('[TwoPanelView] Before constraints:', { newLeftWidth, newRightWidth, minSizeRight, maxSizeRight });
    
    if (minSizeRight) {
      newRightWidth = Math.max(newRightWidth, minSizeRight);
      newLeftWidth = container.offsetWidth - newRightWidth;
    }
    if (maxSizeRight) {
      newRightWidth = Math.min(newRightWidth, maxSizeRight);
      newLeftWidth = container.offsetWidth - newRightWidth;
    }
    
    console.log('[TwoPanelView] After constraints - Setting widths:', { newLeftWidth, newRightWidth });
    setLeftWidth(newLeftWidth);
    setRightWidth(newRightWidth);
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
      <div 
        className={`${styles.leftPanel} ${isSlideoverCollapsed ? styles.rightCollapsed : ''}`} 
        style={{ width: isSlideoverCollapsed ? '100%' : leftWidth }}
      >
        {leftContent}
      </div>

      {slideoverContent && (
        <div
          className={`${styles.rightPanel} ${isSlideoverCollapsed ? styles.collapsed : ''}`}
          style={{ width: isSlideoverCollapsed ? 0 : rightWidth }}
        >
          <div className={styles.rightPanelContent}>{slideoverContent}</div>
          <div
            className={`${styles.collapseButton} ${isSlideoverCollapsed ? styles.collapsed : ''} ${collapseButtonTheme === 'light' ? styles.lightTheme : ''}`}
            onClick={() => {
              const newCollapsedState = !isSlideoverCollapsed;
              setIsSlideoverCollapsed(newCollapsedState);
              onSlideoverCollapse?.(newCollapsedState);
            }}
          >
            {'—'}
          </div>
          <div
            className={`${styles.divider} ${isSlideoverCollapsed ? styles.collapsed : ''}`}
            onMouseDown={handleMouseDown}
          ></div>
        </div>
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
              <div
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
              </div>
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
