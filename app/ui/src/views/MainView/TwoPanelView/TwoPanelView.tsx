import React, { useState } from 'react';
import styles from './TwoPanelView.module.css';
import { Portal } from '../../../components/Portal/Portal';
import { resolveDragCollapse, DEFAULT_COLLAPSE_THRESHOLD } from '../../../hooks/dragCollapse';

interface TwoPanelViewProps {
  initialSizeLeft: number;
  minSizeLeft: number;
  minSizeRight?: number;
  maxSizeRight?: number;
  collapseThreshold?: number;
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
    collapseThreshold = DEFAULT_COLLAPSE_THRESHOLD,
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

  React.useEffect(() => {
    if (slideoverCollapsed !== undefined) setIsSlideoverCollapsed(slideoverCollapsed);
  }, [slideoverCollapsed]);

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
    if (!container || container.dataset.dragging !== 'true') return;

    // Slideover sits on the right; its width is the distance from the mouse
    // to the container's right edge.
    const desiredSlideover = container.getBoundingClientRect().right - e.clientX;

    const result = resolveDragCollapse({
      desiredWidth: desiredSlideover,
      isCollapsed: isSlideoverCollapsed,
      minSize: minSizeRight ?? 0,
      maxSize: maxSizeRight,
      threshold: collapseThreshold,
    });

    if (result.collapsed !== isSlideoverCollapsed) {
      setIsSlideoverCollapsed(result.collapsed);
      onSlideoverCollapse?.(result.collapsed);
    }

    if (!result.collapsed) {
      let newSlideoverWidth = result.width;
      // Don't let the slideover shrink the main content below its minimum.
      if (minSizeLeft) {
        newSlideoverWidth = Math.min(newSlideoverWidth, container.offsetWidth - minSizeLeft);
      }
      setLeftWidth(container.offsetWidth - newSlideoverWidth);
      setRightWidth(newSlideoverWidth);
    }
  }, [isSlideoverCollapsed, minSizeLeft, minSizeRight, maxSizeRight, collapseThreshold, onSlideoverCollapse]);

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

      return () => {
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
        style={{ width: (!slideoverContent || isSlideoverCollapsed) ? '100%' : leftWidth }}
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
              onClick={(e) => e.stopPropagation()}
            />
            <div className={styles.leftPanelContent}>{slideoverContent}</div>
          </div>
          {/* Thin grab handle at the right edge to drag the slideover back open. */}
          {isSlideoverCollapsed && (
            <div
              className={styles.collapsedGrabber}
              onMouseDown={handleMouseDown}
              onClick={(e) => e.stopPropagation()}
            />
          )}
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
