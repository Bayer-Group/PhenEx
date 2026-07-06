import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './FloatingPanel.module.css';

export interface FloatingPanelProps {
  /** Text shown in the drag handle / title bar. */
  title: string;
  /** Called when the user docks the panel back (title-bar button). */
  onClose: () => void;
  children: React.ReactNode;
  /**
   * Whether to render the default dock-back button in the header. Set false
   * when the panel's content provides its own docking control. Defaults to true.
   */
  showDockButton?: boolean;
  initialX?: number;
  initialY?: number;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Drag =
  | { kind: 'move'; startX: number; startY: number; orig: Rect }
  | { kind: 'resize'; dir: string; startX: number; startY: number; orig: Rect };

/** Resize handle directions (edges + corners). */
const RESIZE_DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;

/**
 * A free-floating, draggable and resizable window portaled to `document.body`.
 * Positioned with `position: fixed`, so it can be moved anywhere in the
 * viewport regardless of the parent container it was launched from — mirroring
 * FlexLayout's floating popout, but under our own control.
 */
export const FloatingPanel: React.FC<FloatingPanelProps> = ({
  title,
  onClose,
  children,
  showDockButton = true,
  initialX = 120,
  initialY = 120,
  initialWidth = 320,
  initialHeight = 420,
  minWidth = 220,
  minHeight = 160,
}) => {
  const [rect, setRect] = useState<Rect>({ x: initialX, y: initialY, w: initialWidth, h: initialHeight });
  const dragRef = useRef<Drag | null>(null);

  // Single set of window listeners drives both moving and resizing.
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const { orig } = drag;

      if (drag.kind === 'move') {
        setRect((r) => ({ ...r, x: orig.x + dx, y: orig.y + dy }));
        return;
      }

      setRect(() => {
        let { x, y, w, h } = orig;
        if (drag.dir.includes('e')) w = Math.max(minWidth, orig.w + dx);
        if (drag.dir.includes('s')) h = Math.max(minHeight, orig.h + dy);
        if (drag.dir.includes('w')) {
          w = Math.max(minWidth, orig.w - dx);
          x = orig.x + (orig.w - w);
        }
        if (drag.dir.includes('n')) {
          h = Math.max(minHeight, orig.h - dy);
          y = orig.y + (orig.h - h);
        }
        return { x, y, w, h };
      });
    };

    const onMouseUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [minWidth, minHeight]);

  const startMove = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragRef.current = { kind: 'move', startX: e.clientX, startY: e.clientY, orig: rect };
    document.body.style.userSelect = 'none';
  }, [rect]);

  const startResize = useCallback(
    (dir: string) => (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = { kind: 'resize', dir, startX: e.clientX, startY: e.clientY, orig: rect };
      document.body.style.userSelect = 'none';
    },
    [rect],
  );

  return createPortal(
    <div
      className={styles.panel}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
    >
      <div className={styles.header} onMouseDown={startMove}>
        <span className={styles.title}>{title}</span>
        {showDockButton && (
          <button
            type="button"
            className={styles.dockButton}
            title="Dock back"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
          >
            ⤵
          </button>
        )}
      </div>
      <div className={styles.body}>{children}</div>
      {RESIZE_DIRS.map((dir) => (
        <div
          key={dir}
          className={`${styles.handle} ${styles[`handle_${dir}`]}`}
          onMouseDown={startResize(dir)}
        />
      ))}
    </div>,
    document.body,
  );
};
