import React, { useState, useRef, useCallback } from 'react';
import styles from './ThreePanelView.module.css';
import { useThreePanelCollapse } from '../../../contexts/ThreePanelCollapseContext';
import { resolveDragCollapse, DEFAULT_COLLAPSE_THRESHOLD } from '../../../hooks/dragCollapse';

interface ThreePanelViewProps {
  split: 'vertical';
  initalSizeRight: number;
  initalSizeLeft: number;
  minSizeLeft: number;
  minSizeRight: number;
  collapseThreshold?: number;
  children: React.ReactNode[];
}

export const ThreePanelView: React.FC<ThreePanelViewProps> = ({
  initalSizeLeft,
  initalSizeRight,
  minSizeLeft,
  minSizeRight,
  collapseThreshold = DEFAULT_COLLAPSE_THRESHOLD,
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
  const { isLeftPanelShown, setLeftPanelShown, toggleLeftPanel, isRightPanelShown, setRightPanelShown } = useThreePanelCollapse();
  const isLeftCollapsed = !isLeftPanelShown;
  const isRightCollapsed = !isRightPanelShown;
  const setIsRightCollapsed = (collapsed: boolean) => setRightPanelShown(!collapsed);

  const activeDividerRef = useRef<'left' | 'right' | null>(null);
  const leftCollapsedRef = useRef(isLeftCollapsed);
  const rightCollapsedRef = useRef(isRightCollapsed);
  leftCollapsedRef.current = isLeftCollapsed;
  rightCollapsedRef.current = isRightCollapsed;

  const containerRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    try {
      localStorage.setItem('phenex_three_panel_left_width', leftWidth.toString());
    } catch (error) {
      console.warn('Failed to save left width to localStorage:', error);
    }
  }, [leftWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const container = containerRef.current;
    const divider = activeDividerRef.current;
    if (!container || !divider) return;

    const rect = container.getBoundingClientRect();

    if (divider === 'left') {
      const result = resolveDragCollapse({
        desiredWidth: e.clientX - rect.left,
        isCollapsed: leftCollapsedRef.current,
        minSize: minSizeLeft,
        threshold: collapseThreshold,
      });
      if (result.collapsed !== leftCollapsedRef.current) setLeftPanelShown(!result.collapsed);
      if (!result.collapsed) setLeftWidth(result.width);
    } else {
      const result = resolveDragCollapse({
        desiredWidth: rect.right - e.clientX,
        isCollapsed: rightCollapsedRef.current,
        minSize: minSizeRight,
        threshold: collapseThreshold,
      });
      if (result.collapsed !== rightCollapsedRef.current) setIsRightCollapsed(result.collapsed);
      if (!result.collapsed) setRightWidth(result.width);
    }
  }, [minSizeLeft, minSizeRight, collapseThreshold, setLeftPanelShown]);

  const handleMouseUp = useCallback(() => {
    activeDividerRef.current = null;
    if (containerRef.current) containerRef.current.dataset.dragging = 'false';
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((divider: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    activeDividerRef.current = divider;
    if (containerRef.current) containerRef.current.dataset.dragging = 'true';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove, handleMouseUp]);

  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.metaKey && !e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleLeftPanel();
      }
      if (e.metaKey && e.altKey && e.key.toLowerCase() === '∫') {
        e.preventDefault();
        setIsRightCollapsed(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [toggleLeftPanel]);

  return (
    <div
      ref={containerRef}
      id="three-panel-container"
      className={styles.container}
      data-dragging="false"
      style={
        {
          '--initial-left-width': isLeftCollapsed ? '0px' : `${leftWidth}px`,
          '--initial-right-width': isRightCollapsed ? '0px' : `${rightWidth}px`,
        } as React.CSSProperties
      }
    >
      <div className={`${styles.panel} ${styles.leftPanel} ${isLeftCollapsed ? styles.collapsed : ''}`}>
        <div className={styles.leftPanelContent}>{children[0]}</div>
      </div>

      <div className={`${styles.panel} ${styles.centerPanel}`}>{children[1]}</div>

      <div className={`${styles.panel} ${styles.rightPanel} ${isRightCollapsed ? styles.collapsed : ''}`}>
        {children[2]}
      </div>

      <div
        className={`${styles.divider} ${styles.left}`}
        style={{ left: isLeftCollapsed ? 0 : leftWidth }}
        onMouseDown={handleMouseDown('left')}
      >
        <div className={styles.dividerLine} />
        <button
          className={styles.collapseButton}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); toggleLeftPanel(); }}
          title={isLeftCollapsed ? 'Expand left panel' : 'Collapse left panel'}
        >
          {isLeftCollapsed ? '›' : '‹'}
        </button>
      </div>

      <div
        className={`${styles.divider} ${styles.right}`}
        style={{ right: isRightCollapsed ? 0 : rightWidth }}
        onMouseDown={handleMouseDown('right')}
      >
        <div className={styles.dividerLine} />
        <button
          className={styles.collapseButton}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); setIsRightCollapsed(!isRightCollapsed); }}
          title={isRightCollapsed ? 'Expand right panel' : 'Collapse right panel'}
        >
          {isRightCollapsed ? '‹' : '›'}
        </button>
      </div>
    </div>
  );
};
