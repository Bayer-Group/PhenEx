import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import styles from './ThreePanelView.module.css';
import { WidthAdjustedPortal } from '../../../components/Portal/WidthAdjustedPortal';
import LeftPanelIcon from '../../../assets/icons/left_panel.svg';
import { useThreePanelCollapse } from '../../../contexts/ThreePanelCollapseContext';

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
  const getInitialLeftWidth = () => {
    try {
      const stored = localStorage.getItem('phenex_three_panel_left_width');
      return stored ? parseInt(stored, 10) : initalSizeLeft;
    } catch {
      return initalSizeLeft;
    }
  };

  const [leftWidth, setLeftWidth] = useState(getInitialLeftWidth);
  const [rightWidth, setRightWidth] = useState(initalSizeRight);
  const { isLeftPanelShown, toggleLeftPanel: contextToggleLeftPanel } = useThreePanelCollapse();
  const isLeftCollapsed = !isLeftPanelShown;
  const [isRightCollapsed, setIsRightCollapsed] = useState(true);

  React.useEffect(() => {
    try {
      localStorage.setItem('phenex_three_panel_left_width', leftWidth.toString());
    } catch (error) {
      console.warn('Failed to save left width to localStorage:', error);
    }
  }, [leftWidth]);
  const [isDragging, setIsDragging] = useState(false);
  const [wasDragging, setWasDragging] = useState(false);

  const [activeDivider, setActiveDivider] = useState<'left' | 'right' | null>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  
  // Hover animation state
  const [isHoverAnimating, setIsHoverAnimating] = useState(false);
  const HOVER_TRIGGER_WIDTH = 20; // pixels
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleHoverTriggerEnter = () => {
    if (isLeftCollapsed && !isDragging) {
      // Clear any pending leave timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      setIsHoverAnimating(true);
    }
  };
  
  const handleHoverTriggerLeave = () => {
    // Add a small delay to prevent flickering
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHoverAnimating(false);
    }, 100);
  };

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
      contextToggleLeftPanel();
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
    const button = (
      <div
        className={`${styles.collapseButton} ${styles.left}`}
        onClick={toggleLeftPanel}
        style={{ transform: isLeftCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
      >
        <svg width="25" height="28" viewBox="0 0 25 28" fill="none">
          <path d="M17 25L10.34772 14.0494C10.15571 13.8507 10.16118 13.534 10.35992 13.3422L17 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
    );
    
    // Render to document.body using portal
    return ReactDOM.createPortal(button, document.body);
  };

  const renderRightCollapseButton = () => {
    return (
      <div
        className={`${styles.collapseButton} ${styles.right} ${isRightCollapsed ? styles.collapsed : ''}`}
      >
        {'AI'}
      </div>
    );
  };
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
          '--initial-left-width': isLeftCollapsed ? '0px' : `${leftWidth}px`,
          '--initial-right-width': `${rightWidth}px`,
        } as React.CSSProperties
      }
    >
      <div
        ref={leftPanelRef}
        className={`${styles.panel} ${styles.leftPanel} ${isLeftCollapsed ? styles.collapsed : ''}`}
      >
        {/* Left panel is now just a placeholder - content moved to portal */}
        {renderLeftDivider()}
      </div>
      
      {/* Width-adjusted portal that contains the actual left panel content */}
      <WidthAdjustedPortal
        leftPanelRef={leftPanelRef}
        width={leftWidth}
        isCollapsed={isLeftCollapsed}
        allowResize={!isLeftCollapsed || isHoverAnimating}
        onWidthChange={setLeftWidth}
        minWidth={minSizeLeft}
        marginLeft={0}
        // isHoverAnimating={isHoverAnimating}
        onHoverEnter={handleHoverTriggerEnter}
        onHoverLeave={handleHoverTriggerLeave}
        debug={false}
      >
        <div className={styles.leftPanelWidthAdjustablePortal}>
        {children[0]}


        </div>
      </WidthAdjustedPortal>

      <div className={`${styles.panel} ${styles.centerPanel}`}>
        {/* Hover trigger area for animating portal when collapsed */}
        {isLeftCollapsed && (
          <div 
            className={styles.hoverTrigger}
            style={{ width: `${HOVER_TRIGGER_WIDTH}px` }}
            onMouseEnter={handleHoverTriggerEnter}
            onMouseLeave={handleHoverTriggerLeave}
          />
        )}
        
        {children[1]}
      </div>

      {/* {renderRightCollapseButton()} */}
      <div
        className={`${styles.panel} ${styles.rightPanel} ${isRightCollapsed ? styles.collapsed : ''}`}
      >
        {children[2]}
        {renderRightDivider()}
      </div>
      
      {renderLeftCollapseButton()}
    </div>
  );
};

//←→
