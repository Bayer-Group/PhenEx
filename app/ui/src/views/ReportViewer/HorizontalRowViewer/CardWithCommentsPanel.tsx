import React, { useState, useCallback, useRef, useEffect } from 'react';
import styles from './CardWithCommentsPanel.module.css';

interface CardWithCommentsPanelProps {
  initialSizeLeft: number;
  minSizeLeft: number;
  minSizeRight?: number;
  maxSizeRight?: number;
  rightWidth: number;
  leftContent: React.ReactNode;
  commentsContent: React.ReactNode;
  commentsCollapsed?: boolean;
  onRightWidthChange?: (width: number) => void;
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
  onRightWidthChange,
}) => {
  const [rightWidth, setRightWidthLocal] = useState(controlledRightWidth);
  const [leftWidth, setLeftWidth] = useState(initialSizeLeft);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Recalculate left width from container
  useEffect(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const calc = containerWidth - rightWidth;
      setLeftWidth(minSizeLeft ? Math.max(calc, minSizeLeft) : calc);
    }
  }, [rightWidth, minSizeLeft]);

  // Resize observer
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      const container = containerRef.current;
      if (container && !isDragging && !commentsCollapsed) {
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
  }, [rightWidth, minSizeLeft, minSizeRight, maxSizeRight, isDragging, commentsCollapsed]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    if (containerRef.current) containerRef.current.dataset.dragging = 'true';
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const container = containerRef.current;
    if (!container || container.dataset.dragging !== 'true') return;

    const containerRect = container.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;

    let newLeft = mouseX;
    let newRight = container.offsetWidth - mouseX;

    if (minSizeRight) { newRight = Math.max(newRight, minSizeRight); newLeft = container.offsetWidth - newRight; }
    if (maxSizeRight) { newRight = Math.min(newRight, maxSizeRight); newLeft = container.offsetWidth - newRight; }
    if (minSizeLeft)  { newLeft = Math.max(newLeft, minSizeLeft);   newRight = container.offsetWidth - newLeft; }

    setLeftWidth(newLeft);
    setRightWidth(newRight);
  }, [minSizeLeft, minSizeRight, maxSizeRight, setRightWidth]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    if (containerRef.current) containerRef.current.dataset.dragging = 'false';
  }, []);

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
      <div className={styles.mainPanel} style={{ width: commentsCollapsed ? '100%' : leftWidth }}>
        {leftContent}
      </div>
      {!commentsCollapsed && (
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
