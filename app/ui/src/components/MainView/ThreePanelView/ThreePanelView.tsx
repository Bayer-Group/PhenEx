import React, { useState } from 'react';
import styles from './ThreePanelView.module.css';

interface ThreePanelViewProps {
  split: 'vertical';
  initalSizeRight: number;
  initalSizeLeft: number;
  minSizeLeft: number;
  minSizeRight: number;
  children: React.ReactNode[];
}

export const ThreePanelView: React.FC<ThreePanelViewProps> = ({
  split,
  initalSizeLeft,
  initalSizeRight,
  minSizeLeft,
  minSizeRight,
  children,
}) => {
  const [leftWidth, setLeftWidth] = useState(initalSizeLeft);
  const [rightWidth, setRightWidth] = useState(initalSizeRight);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [activeDivider, setActiveDivider] = useState<'left' | 'right' | null>(null);

  const handleMouseDown = (divider: 'left' | 'right') => (e: React.MouseEvent) => {
    setIsDragging(true);
    setActiveDivider(divider);
    const container = document.getElementById('three-panel-container');
    if (container) {
      container.dataset.dragging = 'true';
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !activeDivider) return;

    const container = document.getElementById('three-panel-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;

    if (activeDivider === 'left') {
      const newWidth = Math.max(minSizeLeft, mouseX - 10);
      setLeftWidth(newWidth);
    } else {
      const newWidth = Math.max(minSizeRight, containerRect.width - mouseX - 7);
      console.log('SETTING RIGTH WIDTH', rightWidth, newWidth);
      setRightWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setActiveDivider(null);
    const container = document.getElementById('three-panel-container');
    if (container) {
      container.dataset.dragging = 'false';
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

  const toggleLeftPanel = () => {
    setIsLeftCollapsed(!isLeftCollapsed);
  };

  const toggleRightPanel = () => {
    console.log('TOGGLING RIGHT PANEL', rightWidth);
    setIsRightCollapsed(!isRightCollapsed);
  };

  return (
    <div id="three-panel-container" className={styles.container}>
      <div
        className={`${styles.panel} ${styles.leftPanel} ${isLeftCollapsed ? styles.collapsed : ''}`}
        style={{ width: isLeftCollapsed ? 0 : leftWidth }}
      >
        {children[0]}
      </div>

      <div className={styles.divider} onMouseDown={handleMouseDown('left')}>
        <div className={styles.dividerLine} />
        <button
          className={`${styles.collapseButton} ${isLeftCollapsed ? styles.collapsed : ''}`}
          onClick={toggleLeftPanel}
        >
          {isLeftCollapsed ? '→' : '←'}
        </button>
      </div>

      <div className={`${styles.panel} ${styles.centerPanel}`}>{children[1]}</div>

      <div className={styles.divider} onMouseDown={handleMouseDown('right')}>
        <div className={styles.dividerLine} />

        <button
          className={`${styles.collapseButton} ${styles.rightCollapseButton} ${isRightCollapsed ? styles.collapsed : ''}`}
          onClick={toggleRightPanel}
        >
          {isRightCollapsed ? '←' : '→'}
        </button>
      </div>

      <div
        className={`${styles.panel} ${styles.rightPanel} ${isRightCollapsed ? styles.collapsed : ''}`}
        style={{ width: isRightCollapsed ? 0 : rightWidth }}
      >
        {children[2]}
      </div>
    </div>
  );
};
