import React, { useState, useCallback, useRef, useEffect } from 'react';
import styles from './CardWithCommentsPanel.module.css';
import { resolveDragCollapse, DEFAULT_COLLAPSE_THRESHOLD } from '../../../hooks/dragCollapse';

interface CardWithCommentsPanelProps {
  initialSizeLeft: number;
  minSizeLeft: number;
  minSizeRight?: number;
  maxSizeRight?: number;
  rightWidth: number;
  leftContent: React.ReactNode;
  commentsContent: React.ReactNode;
  commentsCollapsed?: boolean;
  collapseThreshold?: number;
  onRightWidthChange?: (width: number) => void;
  onCommentsCollapsedChange?: (collapsed: boolean) => void;
}

export const CardWithCommentsPanel: React.FC<CardWithCommentsPanelProps> = ({
  initialSizeLeft,
  minSizeLeft,
  minSizeRight,
  maxSizeRight,
  rightWidth: controlledRightWidth,
  leftContent,
  commentsContent,
  commentsCollapsed = true,
  collapseThreshold = DEFAULT_COLLAPSE_THRESHOLD,
  onRightWidthChange,
  onCommentsCollapsedChange,
}) => {
  const [rightWidth, setRightWidthLocal] = useState(controlledRightWidth);
  const [leftWidth, setLeftWidth] = useState(initialSizeLeft);
  const [collapsed, setCollapsed] = useState(commentsCollapsed);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync collapsed state from prop when not dragging
  useEffect(() => {
    if (!isDragging) setCollapsed(commentsCollapsed);
  }, [commentsCollapsed, isDragging]);

  // Sync from controlled prop when not dragging
  useEffect(() => {
    if (!isDragging) setRightWidthLocal(controlledRightWidth);
  }, [controlledRightWidth, isDragging]);

  const setRightWidth = useCallback((w: number) => {
    setRightWidthLocal(w);
    onRightWidthChange?.(w);
  }, [onRightWidthChange]);

  // Persist right width
  useEffect(() => {
    try {
      localStorage.setItem('phenex_two_panel_right_width', rightWidth.toString());
    } catch { /* ignore */ }
  }, [rightWidth]);

  // Resize observer
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      const container = containerRef.current;
      if (container && !isDragging && !collapsed) {
        const containerWidth = container.offsetWidth;
        let newLeft = containerWidth - rightWidth;
        if (minSizeLeft != null && newLeft < minSizeLeft) {
          const newRight = containerWidth - minSizeLeft;
          setRightWidth(Math.min(maxSizeRight ?? Infinity, Math.max(minSizeRight ?? 0, newRight)));
          setLeftWidth(minSizeLeft);
        } else {
          setLeftWidth(newLeft);
        }
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [rightWidth, minSizeLeft, minSizeRight, maxSizeRight, isDragging, collapsed, setRightWidth]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    if (containerRef.current) containerRef.current.dataset.dragging = 'true';
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const container = containerRef.current;
    if (!container || container.dataset.dragging !== 'true') return;

    const desiredRight = container.getBoundingClientRect().right - e.clientX;

    const result = resolveDragCollapse({
      desiredWidth: desiredRight,
      isCollapsed: collapsed,
      minSize: minSizeRight ?? 0,
      maxSize: maxSizeRight,
      threshold: collapseThreshold,
    });

    setCollapsed(result.collapsed);
    if (!result.collapsed) {
      let newRight = result.width;
      // Never let the comments panel push the main panel below its minimum.
      if (minSizeLeft != null) newRight = Math.min(newRight, container.offsetWidth - minSizeLeft);
      setRightWidth(newRight);
      setLeftWidth(container.offsetWidth - newRight);
    }
  }, [collapsed, minSizeLeft, minSizeRight, maxSizeRight, collapseThreshold, setRightWidth]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    if (containerRef.current) containerRef.current.dataset.dragging = 'false';
    onCommentsCollapsedChange?.(collapsed);
  }, [collapsed, onCommentsCollapsedChange]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className={styles.container} data-dragging="false">
      <div className={styles.mainPanel} style={{ width: collapsed ? '100%' : leftWidth }}>
        {leftContent}
      </div>
      {collapsed ? (
        <div
          className={styles.collapsedGrabber}
          onMouseDown={handleMouseDown}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className={styles.commentsPanel} style={{ width: rightWidth }}>
          <div
            className={styles.divider}
            onMouseDown={handleMouseDown}
            onClick={(e) => e.stopPropagation()}
          />
          <div className={styles.commentsPanelContent}>
            {commentsContent}
          </div>
        </div>
      )}
    </div>
  );
};
