import React, { useState } from 'react';
import styles from './TwoPanelView.module.css';
import stylesXButton from '../../../components/ButtonsAndTabs/XButton/XButton.module.css';
interface TwoPanelViewProps {
  split: 'vertical';
  initialSizeLeft: number;
  minSizeLeft: number;
  children: React.ReactNode[];
}

export const TwoPanelView = React.forwardRef<
  { collapseRightPanel: (collapse: boolean) => void },
  TwoPanelViewProps
>((props, ref) => {
  const { split, initialSizeLeft, minSizeLeft, children } = props;

  React.useImperativeHandle(ref, () => ({
    collapseRightPanel: (collapse: boolean) => setIsRightCollapsed(collapse),
  }));

  const [leftWidth, setLeftWidth] = useState(initialSizeLeft);
  const [rightWidth, setRightWidth] = useState(300);
  const [isRightCollapsed, setIsRightCollapsed] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [wasDragging, setWasDragging] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    console.log('MOUSDING DOWN');
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
    setWasDragging(true);

    const container = document.getElementById('two-panel-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const newRightWidth = Math.max(200, container.offsetWidth - Math.max(minSizeLeft, mouseX - 10));

    const newLeftWidth = container.offsetWidth - newRightWidth;
    setLeftWidth(newLeftWidth);
    if (!isRightCollapsed) {
      setRightWidth(newRightWidth); // 15px for divider width
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      const container = document.getElementById('two-panel-container');
      if (container) {
        container.dataset.dragging = 'false';
      }
      setTimeout(() => {
        setWasDragging(false);
      }, 0);
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
      if (container && !isDragging && !isRightCollapsed) {
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
  }, [leftWidth, rightWidth, isDragging, isRightCollapsed]);

  return (
    <div
      id="two-panel-container"
      ref={containerRef}
      className={`${styles.container} ${split === 'vertical' ? styles.vertical : ''}`}
      data-dragging="false"
    >
      <div className={styles.leftPanel} style={{ width: isRightCollapsed ? '100%' : leftWidth }}>
        {children[0]}
      </div>

      <div
        className={`${styles.rightPanel} ${isRightCollapsed ? styles.collapsed : ''}`}
        style={{ width: isRightCollapsed ? 0 : rightWidth }}
      >
        <div className={styles.rightPanelContent}>{children[1]}</div>
        <div
          className={`${styles.collapseButton} ${stylesXButton.xButton} ${isRightCollapsed ? styles.collapsed : ''}`}
          onClick={() => setIsRightCollapsed(!isRightCollapsed)}
        >
          {'>>'}
          {/* {'×'} */}
        </div>
        <div
          className={`${styles.divider} ${isRightCollapsed ? styles.collapsed : ''}`}
          onMouseDown={handleMouseDown}
        ></div>
      </div>
    </div>
  );
});
