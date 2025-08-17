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
  const [wasDragging, setWasDragging] = useState(false);

  const [activeDivider, setActiveDivider] = useState<'left' | 'right' | null>(null);

  const handleMouseDown = (divider: 'left' | 'right') => (e: React.MouseEvent) => {
    // Check if the click target is a collapse button
    if ((e.target as HTMLElement).classList.contains(styles.collapseButton)) {
      return;
    }
    setIsDragging(true);
    setActiveDivider(divider);
    const container = document.getElementById('three-panel-container');
    if (container) {
      container.dataset.dragging = 'true';
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !activeDivider) return;
    setWasDragging(true);

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
    // Add a small delay before resetting wasDragging to ensure click handler checks it first
    setTimeout(() => {
      setWasDragging(false);
    }, 50);
  };

  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Command+B for left panel
      if (e.metaKey && !e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleLeftPanel();
      }
      // Option+Command+B for right panel
      if (e.metaKey && e.altKey && e.key.toLowerCase() === '∫') {
        e.preventDefault();
        toggleRightPanel();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
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
  }, [isDragging]);

  const toggleLeftPanel = () => {
    if (!wasDragging) {
      setIsLeftCollapsed(prevState => !prevState);
    }
  };

  const toggleRightPanel = () => {
    if (!wasDragging) {
      setIsRightCollapsed(prevState => !prevState);
    }
  };

  const renderLeftDivider = () => {
    return (
      <div
        className={`${styles.divider} ${styles.left}`}
        onMouseDown={handleMouseDown('left')}
        onClick={toggleLeftPanel}
      >
        <div
          className={`${styles.leftDividerPadding} ${isLeftCollapsed ? styles.leftDividercollapsed : ''}`}
        ></div>

        <div className={styles.dividerLine} />
      </div>
    );
  };

  const renderLeftCollapseButton = () => {
    return (
       <button
          className={`${styles.collapseButton} ${styles.left} ${isLeftCollapsed ? styles.collapsed : ''}`}
        >
          <span className={styles.arrow}>{'<<'}</span>
          {/* {isLeftCollapsed ? '>' : '<'} */}
        </button>
    );

  }

    const renderRightCollapseButton = () => {
    return (
        <button
          className={`${styles.collapseButton} ${styles.right} ${isRightCollapsed ? styles.collapsed : ''}`}
        >
          {'AI'}
        </button>
    );

  }
  const renderRightDivider = () => {
    return (
      <div
        className={`${styles.divider} ${styles.right}`}
        onMouseDown={handleMouseDown('right')}
        onClick={toggleRightPanel}
      >
        <div
          className={`${styles.dividerLine} ${styles.right} ${isRightCollapsed ? styles.collapsed : ''}`}
        />
        <div
          className={`${styles.rightDividerPadding} ${isRightCollapsed ? styles.collapsed : ''}`}
        ></div>
      </div>
    );
  };

  return (
    <div
      id="three-panel-container"
      className={styles.container}
      style={
        {
          '--initial-left-width': `${leftWidth}px`,
          '--initial-right-width': `${rightWidth}px`,
        } as React.CSSProperties
      }
    >
      <div
        className={`${styles.panel} ${styles.leftPanel} ${isLeftCollapsed ? styles.collapsed : ''}`}
      >
        {children[0]}
      {renderLeftDivider()}
      </div>

      {renderLeftCollapseButton()}


      <div className={`${styles.panel} ${styles.centerPanel}`}>{children[1]}</div>

      {renderRightCollapseButton()}
      <div
        className={`${styles.panel} ${styles.rightPanel} ${isRightCollapsed ? styles.collapsed : ''}`}
      >
        {children[2]}
        {renderRightDivider()}
      </div>
    </div>
  );
};

//←→
