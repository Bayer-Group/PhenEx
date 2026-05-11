import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Portal } from './Portal';
import styles from './HoverOrDragPortal.module.css';

interface HoverOrDragPortalProps {
  children: React.ReactNode;
  /** Fixed-position x for initial placement. */
  x: number;
  /** Fixed-position y for initial placement. */
  y: number;
  /** Called when the portal should close (mouse-leave in hover mode). */
  onClose: () => void;
}

const DRAG_THRESHOLD = 5;

export const HoverOrDragPortal: React.FC<HoverOrDragPortalProps> = ({
  children,
  x,
  y,
  onClose,
}) => {
  const [pos, setPos] = useState({ x, y });
  const [pinned, setPinned] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const hasMoved = useRef(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Sync initial position when props change (re-open at new location)
  useEffect(() => {
    if (!pinned) setPos({ x, y });
  }, [x, y, pinned]);

  /* ── Drag handling ──────────────────────────────────────────────── */

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    hasMoved.current = false;
    setDragging(true);
  }, [pos]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.mx;
      const dy = e.clientY - dragStart.current.my;
      if (!hasMoved.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      hasMoved.current = true;
      setPos({ x: dragStart.current.px + dx, y: dragStart.current.py + dy });
    };

    const onUp = () => {
      setDragging(false);
      if (hasMoved.current) {
        setPinned(true);
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging]);

  /* ── Hover-to-dismiss (only when not pinned) ────────────────────── */

  const onMouseLeave = useCallback(() => {
    if (!pinned && !dragging) {
      onClose();
    }
  }, [pinned, dragging, onClose]);

  /* ── Click-outside to close when pinned ─────────────────────────── */

  useEffect(() => {
    if (!pinned) return;

    const handler = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay so the current click doesn't immediately close
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', handler);
    };
  }, [pinned, onClose]);

  /* ── Escape to close ────────────────────────────────────────────── */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <Portal>
      <div
        ref={overlayRef}
        className={`${styles.overlay} ${pinned ? styles.pinned : ''}`}
        style={{ left: pos.x, top: pos.y }}
        onMouseLeave={onMouseLeave}
      >
        <div className={styles.dragBar} onMouseDown={onMouseDown}>
          <span className={styles.dragDots}>• • •</span>
        </div>
        <div className={styles.body}>
          {children}
        </div>
      </div>
    </Portal>
  );
};
