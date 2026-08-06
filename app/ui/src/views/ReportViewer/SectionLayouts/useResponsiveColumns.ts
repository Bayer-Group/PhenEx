import { type RefObject, useEffect, useState } from 'react';

function widthToColumns(width: number): number {
  if (width < 500) return 1;
  if (width < 800) return 2;
  if (width < 1000) return 3;
  if (width < 1300) return 4;
  return 5;
}

/** Returns the number of grid columns appropriate for the observed element's width. */
export function useResponsiveColumns(ref: RefObject<HTMLElement | null>): number {
  const [columns, setColumns] = useState(3);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setColumns(widthToColumns(entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return columns;
}
