import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import styles from './CardWithCommentsPanel.module.css';

interface CardWithCommentsPanelProps {
  initialSizeLeft: number;
  minSizeLeft: number;
  minSizeRight?: number;
  maxSizeRight?: number;
  leftContent: React.ReactNode;
  commentsContent: React.ReactNode;
  commentsCollapsed?: boolean;
}

export const CardWithCommentsPanel: React.FC<CardWithCommentsPanelProps> = ({
  initialSizeLeft,
  minSizeLeft,
  minSizeRight,
  maxSizeRight,
  leftContent,
  commentsContent,
  commentsCollapsed = false,
}) => {
  const initialRightWidth = useMemo(() => {
    try {
      const stored = localStorage.getItem('phenex_two_panel_right_width');
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (minSizeRight && parsed < minSizeRight) return minSizeRight;
        if (maxSizeRight && parsed > maxSizeRight) return maxSizeRight;
        return parsed;
      }
    } catch {
      // Fall through
    }
    return minSizeRight || 150;
  }, [minSizeRight, maxSizeRight]);

  const [rightWidth, setRightWidth] = useState(initialRightWidth);
  const [leftWidth, setLeftWidth] = useState(initialSizeLeft);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
  }, [minSizeLeft, minSizeRight, maxSizeRight]);

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
