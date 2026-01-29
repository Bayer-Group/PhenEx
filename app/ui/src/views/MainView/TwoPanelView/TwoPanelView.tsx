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
    if ((e.target as HTMLElement).classList.contains(styles.collapseButton)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    const container = containerRef.current;
    if (container) {
      container.dataset.dragging = 'true';
    }
  };

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;
    
    if (container.dataset.dragging !== 'true') return;

    const containerRect = container.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    let newRightWidth = Math.max(minSizeLeft, container.offsetWidth - Math.max(minSizeLeft, mouseX - 10));
    
    if (minSizeRight) {
      newRightWidth = Math.max(newRightWidth, minSizeRight);
    }
    if (maxSizeRight) {
      newRightWidth = Math.min(newRightWidth, maxSizeRight);
    }
    
    const newLeftWidth = container.offsetWidth - newRightWidth;
    setLeftWidth(newLeftWidth);
    setRightWidth(newRightWidth);
  }, [minSizeLeft, minSizeRight, maxSizeRight]);

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
    const container = containerRef.current;
    if (container) {
      container.dataset.dragging = 'false';
    }
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
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
