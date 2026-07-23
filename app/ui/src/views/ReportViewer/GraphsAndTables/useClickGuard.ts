import { useCallback, useRef } from 'react';

const CLICK_THRESHOLD = 5;

/** Suppresses onClick when the mouse moved more than a few pixels (i.e. a drag/pan). */
export function useClickGuard(handler: () => void) {
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    startPos.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onClick = useCallback((e: React.MouseEvent) => {
    if (startPos.current) {
      const dx = Math.abs(e.clientX - startPos.current.x);
      const dy = Math.abs(e.clientY - startPos.current.y);
      if (dx > CLICK_THRESHOLD || dy > CLICK_THRESHOLD) return;
    }
    handler();
  }, [handler]);
  return { onMouseDown, onClick };
}
