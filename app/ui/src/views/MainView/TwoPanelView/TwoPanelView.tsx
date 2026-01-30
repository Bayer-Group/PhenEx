import React, { useState } from 'react';
import styles from './TwoPanelView.module.css';
import { Portal } from '../../../components/Portal/Portal';
interface TwoPanelViewProps {
  split: 'vertical' | 'horizontal';
  initialSizeLeft: number;
  minSizeLeft: number;
  maxSizeRight?: number;
  children: React.ReactNode[];
  collapseButtonTheme?: 'light' | 'dark'; // Add this prop
  onRightPanelCollapse?: (isCollapsed: boolean) => void; // Add this prop
  viewType?: 'slideover' | 'popover';
}

export const TwoPanelView = React.forwardRef<
  { 
    collapseRightPanel: (collapse: boolean) => void;
    collapseBottomPanel: (collapse: boolean) => void;
  },
  TwoPanelViewProps
>((props, ref) => {
  const { split, initialSizeLeft, minSizeLeft, maxSizeRight, children, collapseButtonTheme = 'dark', onRightPanelCollapse } = props;
  const viewType = props.viewType || 'popover';

  React.useImperativeHandle(ref, () => ({
    collapseRightPanel: (collapse: boolean) => {
      setIsRightCollapsed(collapse);
      onRightPanelCollapse?.(collapse);
    },
    collapseBottomPanel: (collapse: boolean) => setIsBottomCollapsed(collapse),
  }));

  const [leftWidth, setLeftWidth] = useState(initialSizeLeft);
  const [rightWidth, setRightWidth] = useState(300);
  const [topHeight, setTopHeight] = useState(initialSizeLeft);
  const [bottomHeight, setBottomHeight] = useState(300);
  const [isRightCollapsed, setIsRightCollapsed] = useState(true);
  const [isBottomCollapsed, setIsBottomCollapsed] = useState(false); // Start with bottom panel visible
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains(styles.collapseButton)) {
      return;
    }
    setIsDragging(true);
    const container = document.getElementById('two-panel-container');
    if (container) {
      container.dataset.dragging = 'true';
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const container = document.getElementById('two-panel-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    if (split === 'vertical') {
      const mouseX = e.clientX - containerRect.left;
      let newRightWidth = Math.max(minSizeLeft, container.offsetWidth - Math.max(minSizeLeft, mouseX - 10));
      if (maxSizeRight) {
        newRightWidth = Math.min(newRightWidth, maxSizeRight);
      }
      const newLeftWidth = container.offsetWidth - newRightWidth;
      setLeftWidth(newLeftWidth);
      if (!isRightCollapsed) {
        setRightWidth(newRightWidth);
      }
    } else {
      // Horizontal split
      const mouseY = e.clientY - containerRect.top;
      const newBottomHeight = Math.max(200, container.offsetHeight - Math.max(minSizeLeft, mouseY - 10));
      const newTopHeight = container.offsetHeight - newBottomHeight;
      setTopHeight(newTopHeight);
      if (!isBottomCollapsed) {
        setBottomHeight(newBottomHeight);
      }
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      const container = document.getElementById('two-panel-container');
      if (container) {
        container.dataset.dragging = 'false';
      }
    }
  };

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  React.useEffect(() => {
    const observer = new ResizeObserver(() => {
      const container = containerRef.current;
      if (container && !isDragging) {
        if (split === 'vertical' && !isRightCollapsed) {
          const containerWidth = container.offsetWidth;
          const newRightWidth = Math.max(
            200,
            containerWidth * (rightWidth / (leftWidth + rightWidth))
          );
          const newLeftWidth = containerWidth - newRightWidth;
          setLeftWidth(newLeftWidth);
          setRightWidth(newRightWidth);
        } else if (split === 'horizontal' && !isBottomCollapsed) {
          const containerHeight = container.offsetHeight;
          const newBottomHeight = Math.max(
            200,
            containerHeight * (bottomHeight / (topHeight + bottomHeight))
          );
          const newTopHeight = containerHeight - newBottomHeight;
          setTopHeight(newTopHeight);
          setBottomHeight(newBottomHeight);
        }
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [leftWidth, rightWidth, topHeight, bottomHeight, isDragging, isRightCollapsed, isBottomCollapsed, split]);

  const renderBottomTitleButton = () =>{
    return (
      <div
        className={`${styles.collapseButtonHorizontal} ${isBottomCollapsed ? styles.collapsed : ''} ${collapseButtonTheme === 'light' ? styles.lightTheme : ''}`}
        onClick={() => setIsBottomCollapsed(!isBottomCollapsed)}
      >
        Components <span className={styles.collapseArrows}>{'>'}</span>
      </div>
    );
  }

  return (
    <div
      id="two-panel-container"
      ref={containerRef}
      className={`${styles.container} ${split === 'vertical' ? styles.vertical : styles.horizontal}`}
      data-dragging="false"
    >
      {split === 'vertical' ? (
        <>
          <div className={`${styles.leftPanel} ${isRightCollapsed && viewType === 'slideover' ? styles.rightCollapsed : ''}`} style={{ width: (isRightCollapsed || viewType !== 'slideover') ? '100%' : leftWidth }}>
            {children[0]}
          </div>

          {viewType === 'slideover' ? (
            <div
              className={`${styles.rightPanel} ${isRightCollapsed ? styles.collapsed : ''}`}
              style={{ width: isRightCollapsed ? 0 : rightWidth }}
            >
              <div className={styles.rightPanelContent}>{children[1]}</div>
              <div
                className={`${styles.collapseButton} ${isRightCollapsed ? styles.collapsed : ''} ${collapseButtonTheme === 'light' ? styles.lightTheme : ''}`}
                onClick={() => {
                  const newCollapsedState = !isRightCollapsed;
                  setIsRightCollapsed(newCollapsedState);
                  onRightPanelCollapse?.(newCollapsedState);
                }}
              >
                {'—'}
              </div>
              <div
                className={`${styles.divider} ${isRightCollapsed ? styles.collapsed : ''}`}
                onMouseDown={handleMouseDown}
              ></div>
            </div>
          ) : (
            !isRightCollapsed && (
              <Portal>
                <div className={`${styles.popoverOverlay} ${isClosing ? styles.closing : ''}`} onClick={() => {
                    setIsClosing(true);
                    setTimeout(() => {
                      setIsRightCollapsed(true);
                      setIsClosing(false);
                      onRightPanelCollapse?.(true);
                    }, 100);
                }}>
                  <div className={`${styles.popoverContent} ${isClosing ? styles.closing : ''}`} onClick={(e) => e.stopPropagation()}>
                    <div className={styles.rightPanelContent}>
                        {children[1]}
                    </div>
                  </div>
                </div>
              </Portal>
            )
          )}
        </>
      ) : (
        <>
          <div className={styles.topPanel} style={{ height: isBottomCollapsed ? '100%' : topHeight }}>
            <>
            {children[0]}
          </>
          </div>

          <div
            className={`${styles.bottomPanel} ${isBottomCollapsed ? styles.collapsed : ''}`}
            style={{ height: isBottomCollapsed ? 0 : bottomHeight }}
          >
            {renderBottomTitleButton()}
            <div className={styles.bottomPanelContent}>

              {children[1]}
            </div>

            <div
              className={`${styles.dividerHorizontal} ${isBottomCollapsed ? styles.collapsed : ''}`}
              onMouseDown={handleMouseDown}
            ></div>
          </div>
        </>
      )}
    </div>
  );
});
