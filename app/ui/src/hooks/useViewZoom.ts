import { useRef, useEffect, useCallback, useState } from 'react';

interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

interface UseViewZoomOptions {
  minScale?: number;
  maxScale?: number;
  initialTransform?: ViewTransform;
  storageKey?: string;
  onZoomChange?: (percentage: number) => void;
  onTransformChange?: (x: number, y: number, scale: number) => void;
}

interface UseViewZoomReturn {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  transformRef: React.RefObject<HTMLDivElement | null>;
  zoomPercentage: number;
  setZoomPercentage: (percentage: number) => void;
  panToX: (contentX: number, viewFraction?: number) => void;
  panTo: (contentX: number, contentY: number) => void;
  currentScale: number;
}

const scaleToPercentage = (scale: number, min: number, max: number): number =>
  ((scale - min) / (max - min)) * 100;

const percentageToScale = (percentage: number, min: number, max: number): number =>
  min + (percentage / 100) * (max - min);

export function useViewZoom(options: UseViewZoomOptions = {}): UseViewZoomReturn {
  const {
    minScale = 0.3,
    maxScale = 1.5,
    initialTransform,
    storageKey,
    onZoomChange,
    onTransformChange,
  } = options;

  const loadInitial = (): ViewTransform => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return initialTransform ?? { x: 0, y: 0, scale: 1 };
  };

  const viewportRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<HTMLDivElement>(null);
  const currentTransform = useRef<ViewTransform>(loadInitial());
  const persistTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastZoomTime = useRef(0);

  const [zoomPercentage, setZoomPercentageState] = useState(() =>
    scaleToPercentage(currentTransform.current.scale, minScale, maxScale),
  );

  const applyTransform = useCallback(
    (x: number, y: number, scale: number) => {
      if (transformRef.current) {
        transformRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
        transformRef.current.style.setProperty('--pz-scale', scale.toString());
        // Legacy alias kept for existing CSS that references --zoom-scale
        transformRef.current.style.setProperty('--zoom-scale', scale.toString());
      }
      currentTransform.current = { x, y, scale };

      const pct = scaleToPercentage(scale, minScale, maxScale);
      setZoomPercentageState(pct);
      onZoomChange?.(pct);
      onTransformChange?.(x, y, scale);

      if (storageKey) {
        if (persistTimeout.current) clearTimeout(persistTimeout.current);
        persistTimeout.current = setTimeout(() => {
          localStorage.setItem(storageKey, JSON.stringify({ x, y, scale }));
        }, 500);
      }
    },
    [minScale, maxScale, storageKey, onZoomChange, onTransformChange],
  );

  const setZoomPercentage = useCallback(
    (percentage: number) => {
      const newScale = percentageToScale(Math.max(0, Math.min(100, percentage)), minScale, maxScale);
      const current = currentTransform.current;

      if (viewportRef.current) {
        const centerX = viewportRef.current.clientWidth / 2;
        const centerY = viewportRef.current.clientHeight / 2;
        const pointX = (centerX - current.x) / current.scale;
        const pointY = (centerY - current.y) / current.scale;
        const newX = centerX - pointX * newScale;
        const newY = centerY - pointY * newScale;
        applyTransform(newX, newY, newScale);
      } else {
        applyTransform(current.x, current.y, newScale);
      }
    },
    [minScale, maxScale, applyTransform],
  );

  // Wheel handler: Cmd+scroll = zoom, scroll = vertical pan, shift+scroll = horizontal pan
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const wheelHandler = (e: WheelEvent) => {
      e.preventDefault();

      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {}, 150);

      const current = currentTransform.current;
      const isCommand = e.metaKey || e.ctrlKey;

      if (isCommand) {
        lastZoomTime.current = Date.now();
        const zoomSpeed = 0.01;
        const delta = -e.deltaY * zoomSpeed;
        const newScale = Math.max(minScale, Math.min(maxScale, current.scale * (1 + delta)));
        const centerX = el.clientWidth / 2;
        const centerY = el.clientHeight / 2;
        const pointX = (centerX - current.x) / current.scale;
        const pointY = (centerY - current.y) / current.scale;
        const newX = centerX - pointX * newScale;
        const newY = centerY - pointY * newScale;
        applyTransform(newX, newY, newScale);
      } else {
        if (Date.now() - lastZoomTime.current < 200) return;

        if (e.shiftKey) {
          const deltaX = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
          applyTransform(current.x - deltaX, current.y, current.scale);
        } else {
          applyTransform(current.x, current.y - e.deltaY, current.scale);
        }
      }
    };

    el.addEventListener('wheel', wheelHandler, { passive: false });
    return () => {
      el.removeEventListener('wheel', wheelHandler);
      if (persistTimeout.current) clearTimeout(persistTimeout.current);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [minScale, maxScale, applyTransform]);

  // Mouse drag to pan (left-click with threshold)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    let isPending = false;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let startTransformX = 0;
    let startTransformY = 0;
    const DRAG_THRESHOLD = 5;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;

      // Don't capture if target is inside an interactive element outside the transform area
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, select, textarea, [data-no-pan]')) return;

      isPending = true;
      isDragging = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      startTransformX = currentTransform.current.x;
      startTransformY = currentTransform.current.y;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isPending && !isDragging) return;

      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      if (isPending && !isDragging) {
        if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
        isDragging = true;
        isPending = false;
        el.style.cursor = 'grabbing';
        e.preventDefault();
      }

      if (isDragging) {
        e.preventDefault();
        applyTransform(
          startTransformX + dx,
          startTransformY + dy,
          currentTransform.current.scale,
        );
      }
    };

    const onMouseUp = () => {
      isPending = false;
      if (isDragging) {
        isDragging = false;
        el.style.cursor = '';
      }
    };

    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [applyTransform]);

  // Apply initial transform on mount
  useEffect(() => {
    const { x, y, scale } = currentTransform.current;
    applyTransform(x, y, scale);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const panAnimRef = useRef<number | null>(null);

  const panToX = useCallback(
    (contentX: number, viewFraction = 0.5) => {
      if (!viewportRef.current) return;
      const { scale, x: startX, y: startY } = currentTransform.current;
      const targetX = viewportRef.current.clientWidth * viewFraction - contentX * scale;
      const targetY = 30;
      const duration = 500;
      const startTime = performance.now();

      if (panAnimRef.current !== null) cancelAnimationFrame(panAnimRef.current);

      const ease = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      const step = (now: number) => {
        const t = Math.min((now - startTime) / duration, 1);
        const e = ease(t);
        applyTransform(startX + (targetX - startX) * e, startY + (targetY - startY) * e, scale);
        if (t < 1) panAnimRef.current = requestAnimationFrame(step);
        else panAnimRef.current = null;
      };

      panAnimRef.current = requestAnimationFrame(step);
    },
    [applyTransform],
  );

  const panTo = useCallback(
    (contentX: number, contentY: number) => {
      if (!viewportRef.current) return;
      const { scale, x: startX, y: startY } = currentTransform.current;
      const targetX = -contentX * scale + 100;
      const targetY = -contentY * scale + 100;
      const duration = 500;
      const startTime = performance.now();

      if (panAnimRef.current !== null) cancelAnimationFrame(panAnimRef.current);

      const ease = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      const step = (now: number) => {
        const t = Math.min((now - startTime) / duration, 1);
        const e = ease(t);
        applyTransform(
          startX + (targetX - startX) * e,
          startY + (targetY - startY) * e,
          scale,
        );
        if (t < 1) panAnimRef.current = requestAnimationFrame(step);
        else panAnimRef.current = null;
      };

      panAnimRef.current = requestAnimationFrame(step);
    },
    [applyTransform],
  );

  return {
    viewportRef,
    transformRef,
    zoomPercentage,
    setZoomPercentage,
    panToX,
    panTo,
    currentScale: currentTransform.current.scale,
  };
}
