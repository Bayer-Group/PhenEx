/**
 * Pan-and-zoom hook with scroll bounds clamping and scrollbar integration.
 *
 * Manages a CSS transform on a content element inside a viewport element.
 * Scroll is clamped so content cannot be panned past its edges.
 * Scrollbar thumb positions are updated imperatively (no React re-renders
 * during pan/scroll) via refs owned by this hook and rendered by
 * <PanZoomScrollbar>.
 */
import { useRef, useEffect, useCallback, useState } from 'react';

interface Transform {
  x: number;
  y: number;
  scale: number;
}

export interface UsePanZoomOptions {
  minScale?: number;
  maxScale?: number;
  initialTransform?: Transform;
  /** Horizontal overscroll pixels beyond content edges (default 100). */
  paddingX?: number;
  /** Vertical overscroll pixels beyond content edges (default 400). */
  paddingY?: number;
  /** localStorage key for persisting transform state. */
  storageKey?: string;
  /** X offset when panning to content (default 20). */
  panTargetXOffset?: number;
  /** Y offset when panning to content (default 100). */
  panTargetYOffset?: number;
}

export interface ScrollbarBinding {
  hTrackRef: React.RefObject<HTMLDivElement | null>;
  vTrackRef: React.RefObject<HTMLDivElement | null>;
  hThumbRef: React.RefObject<HTMLDivElement | null>;
  vThumbRef: React.RefObject<HTMLDivElement | null>;
  onScrollH: (fraction: number) => void;
  onScrollV: (fraction: number) => void;
}

export interface UsePanZoomReturn {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  /** Current scale factor (reactive). */
  scale: number;
  zoomPercentage: number;
  setZoomPercentage: (pct: number) => void;
  panToContent: (contentX: number, contentY: number) => void;
  /** Reset to initial transform (animated). */
  resetView: () => void;
  /** Call after content dimensions may have changed. */
  remeasure: () => void;
  scrollbar: ScrollbarBinding;
}

export function usePanZoom(options: UsePanZoomOptions = {}): UsePanZoomReturn {
  // Store options in a ref so all closures read the latest values
  const optsRef = useRef(options);
  optsRef.current = options;

  const {
    minScale = 0.1,
    maxScale = 1.2,
    initialTransform = { x: 0, y: 0, scale: 1 },
  } = options;

  // ── Refs ──────────────────────────────────────────────────────────────
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const t = useRef<Transform>({ ...initialTransform });
  const cs = useRef({ w: 0, h: 0 }); // content natural size
  const animRef = useRef<number | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScaleReported = useRef(initialTransform.scale);

  // Scrollbar element refs
  const hTrackRef = useRef<HTMLDivElement>(null);
  const vTrackRef = useRef<HTMLDivElement>(null);
  const hThumbRef = useRef<HTMLDivElement>(null);
  const vThumbRef = useRef<HTMLDivElement>(null);

  // Only React state: zoom percentage (drives ZoomScrubber re-render)
  const [zoomPct, setZoomPct] = useState(
    ((initialTransform.scale - minScale) / (maxScale - minScale)) * 100,
  );

  // ── Pure helpers (read only from refs — safe in stale closures) ──────

  function getOpt<K extends keyof UsePanZoomOptions>(
    key: K,
    fallback: NonNullable<UsePanZoomOptions[K]>,
  ): NonNullable<UsePanZoomOptions[K]> {
    return (optsRef.current[key] ?? fallback) as NonNullable<UsePanZoomOptions[K]>;
  }

  function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v));
  }

  function vpDims() {
    const vp = viewportRef.current;
    return vp ? { w: vp.clientWidth, h: vp.clientHeight } : { w: 0, h: 0 };
  }

  function getBounds() {
    const padX = getOpt('paddingX', 600);
    const padY = getOpt('paddingY', 400);
    const vp = vpDims();
    const s = t.current.scale;
    const cw = cs.current.w * s;
    const ch = cs.current.h * s;

    const axis = (visual: number, viewport: number, pad: number) => {
      if (visual <= viewport) {
        // Content fits — allow padding around the centered position
        const center = (viewport - visual) / 2;
        return { min: center - pad, max: center + pad };
      }
      return { min: viewport - visual - pad, max: pad };
    };

    const h = axis(cw, vp.w, padX);
    const v = axis(ch, vp.h, padY);
    return { minX: h.min, maxX: h.max, minY: v.min, maxY: v.max };
  }

  /** Apply the current transform to the DOM and update scrollbar thumbs. */
  function apply() {
    const el = contentRef.current;
    if (el) {
      el.style.transform = `translate(${t.current.x}px, ${t.current.y}px) scale(${t.current.scale})`;
      el.style.transformOrigin = '0 0';
      el.style.setProperty('--pz-scale', String(t.current.scale));
    }

    const vp = vpDims();
    const s = t.current.scale;
    const b = getBounds();

    // Horizontal scrollbar
    const cw = cs.current.w * s;
    const canH = cw > vp.w;
    if (hTrackRef.current) hTrackRef.current.style.display = canH ? '' : 'none';
    if (canH && hThumbRef.current) {
      const size = Math.max(0.05, vp.w / (cw + (getOpt('paddingX', 100)) * 2));
      const range = b.maxX - b.minX;
      const pos = range > 0 ? clamp((b.maxX - t.current.x) / range, 0, 1) : 0;
      hThumbRef.current.style.width = `${size * 100}%`;
      hThumbRef.current.style.left = `${pos * (1 - size) * 100}%`;
    }

    // Vertical scrollbar
    const ch = cs.current.h * s;
    const canV = ch > vp.h;
    if (vTrackRef.current) vTrackRef.current.style.display = canV ? '' : 'none';
    if (canV && vThumbRef.current) {
      const size = Math.max(0.05, vp.h / (ch + (getOpt('paddingY', 400)) * 2));
      const range = b.maxY - b.minY;
      const pos = range > 0 ? clamp((b.maxY - t.current.y) / range, 0, 1) : 0;
      vThumbRef.current.style.height = `${size * 100}%`;
      vThumbRef.current.style.top = `${pos * (1 - size) * 100}%`;
    }

    // Update zoom percentage state only when scale changes
    if (t.current.scale !== lastScaleReported.current) {
      lastScaleReported.current = t.current.scale;
      const mn = getOpt('minScale', 0.1);
      const mx = getOpt('maxScale', 2);
      setZoomPct(((t.current.scale - mn) / (mx - mn)) * 100);
    }

    // Persist (debounced)
    const key = optsRef.current.storageKey;
    if (key) {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(
        () => localStorage.setItem(key, JSON.stringify(t.current)),
        300,
      );
    }
  }

  /** Set transform with bounds clamping. */
  function setTransform(x: number, y: number, scale: number) {
    t.current.scale = scale;
    const b = getBounds();
    t.current = {
      x: clamp(x, b.minX, b.maxX),
      y: clamp(y, b.minY, b.maxY),
      scale,
    };
    apply();
  }

  /** Measure current content dimensions and re-clamp. */
  function measure() {
    const el = contentRef.current;
    if (!el) return;
    cs.current = { w: el.scrollWidth, h: el.scrollHeight };
    const b = getBounds();
    t.current.x = clamp(t.current.x, b.minX, b.maxX);
    t.current.y = clamp(t.current.y, b.minY, b.maxY);
    apply();
  }

  // ── Initialization ────────────────────────────────────────────────────

  useEffect(() => {
    // Load persisted transform
    const key = optsRef.current.storageKey;
    if (key) {
      try {
        const saved = localStorage.getItem(key);
        if (saved) t.current = JSON.parse(saved);
      } catch { /* ignore */ }
    }
    measure();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ResizeObserver ────────────────────────────────────────────────────

  useEffect(() => {
    const vp = viewportRef.current;
    const ct = contentRef.current;
    if (!vp || !ct) return;

    const ro = new ResizeObserver(() => measure());
    ro.observe(vp);
    ro.observe(ct);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Wheel handler ─────────────────────────────────────────────────────

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    let lastZoomTime = 0;

    /** Zoom around a viewport-relative point. */
    function zoomAt(vpX: number, vpY: number, newScale: number) {
      const mn = getOpt('minScale', 0.1);
      const mx = getOpt('maxScale', 2);
      const s = clamp(newScale, mn, mx);
      const contentX = (vpX - t.current.x) / t.current.scale;
      const contentY = (vpY - t.current.y) / t.current.scale;
      setTransform(vpX - contentX * s, vpY - contentY * s, s);
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.metaKey || e.ctrlKey) {
        // Cmd+scroll or trackpad pinch (browsers set ctrlKey for pinch)
        lastZoomTime = Date.now();
        const delta = -e.deltaY * 0.008;
        const rect = el.getBoundingClientRect();
        zoomAt(
          e.clientX - rect.left,
          e.clientY - rect.top,
          t.current.scale * (1 + delta),
        );
      } else {
        if (Date.now() - lastZoomTime < 200) return;
        // Pan: vertical only (shift+scroll for horizontal)
        if (e.shiftKey) {
          const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
          setTransform(t.current.x - dx, t.current.y, t.current.scale);
        } else {
          setTransform(t.current.x, t.current.y - e.deltaY, t.current.scale);
        }
      }
    };

    // Safari fires gesturestart/gesturechange for trackpad pinch instead
    // of ctrlKey wheel events.
    let gestureStartScale = 1;

    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gestureStartScale = t.current.scale;
    };

    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const ge = e as unknown as { scale: number; clientX: number; clientY: number };
      lastZoomTime = Date.now();
      const rect = el.getBoundingClientRect();
      zoomAt(
        ge.clientX - rect.left,
        ge.clientY - rect.top,
        gestureStartScale * ge.scale,
      );
    };

    const onGestureEnd = (e: Event) => { e.preventDefault(); };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart, { passive: false } as AddEventListenerOptions);
    el.addEventListener('gesturechange', onGestureChange, { passive: false } as AddEventListenerOptions);
    el.addEventListener('gestureend', onGestureEnd, { passive: false } as AddEventListenerOptions);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('gestureend', onGestureEnd);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drag to pan ───────────────────────────────────────────────────────

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    let pending = false;
    let dragging = false;
    let startMX = 0, startMY = 0, startTX = 0, startTY = 0;
    const THRESHOLD = 5;

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('button, a, input, select, textarea, [data-no-pan]')) return;
      pending = true;
      startMX = e.clientX;
      startMY = e.clientY;
      startTX = t.current.x;
      startTY = t.current.y;
    };

    const onMove = (e: MouseEvent) => {
      if (!pending && !dragging) return;
      const dx = e.clientX - startMX;
      const dy = e.clientY - startMY;
      if (pending && !dragging) {
        if (Math.abs(dx) + Math.abs(dy) < THRESHOLD) return;
        dragging = true;
        pending = false;
        el.style.cursor = 'grabbing';
        e.preventDefault();
      }
      if (dragging) {
        e.preventDefault();
        setTransform(startTX + dx, startTY + dy, t.current.scale);
      }
    };

    const onUp = () => {
      pending = false;
      if (dragging) {
        dragging = false;
        el.style.cursor = '';
      }
    };

    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Public API (stable callbacks) ─────────────────────────────────────

  const setZoomPercentage = useCallback((pct: number) => {
    const mn = getOpt('minScale', 0.1);
    const mx = getOpt('maxScale', 2);
    const newScale = mn + (clamp(pct, 0, 100) / 100) * (mx - mn);
    const vp = vpDims();
    // Zoom around viewport center
    const cx = vp.w / 2;
    const cy = vp.h / 2;
    const contentX = (cx - t.current.x) / t.current.scale;
    const contentY = (cy - t.current.y) / t.current.scale;
    setTransform(cx - contentX * newScale, cy - contentY * newScale, newScale);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const panToContent = useCallback((contentX: number, contentY: number) => {
    const { scale, x: startX, y: startY } = t.current;
    const targetX = -contentX * scale + getOpt('panTargetXOffset', 20);
    const targetY = -contentY * scale + getOpt('panTargetYOffset', 100);
    const duration = 400;
    const start = performance.now();

    if (animRef.current) cancelAnimationFrame(animRef.current);

    const ease = (p: number) => (p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p);

    const step = (now: number) => {
      const p = clamp((now - start) / duration, 0, 1);
      const e = ease(p);
      setTransform(
        startX + (targetX - startX) * e,
        startY + (targetY - startY) * e,
        scale,
      );
      if (p < 1) animRef.current = requestAnimationFrame(step);
      else animRef.current = null;
    };
    animRef.current = requestAnimationFrame(step);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const remeasure = useCallback(() => measure(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const resetView = useCallback(() => {
    const { x: startX, y: startY, scale: startScale } = t.current;
    const targetX = initialTransform.x;
    const targetY = initialTransform.y;
    const targetScale = initialTransform.scale;
    const duration = 400;
    const start = performance.now();

    if (animRef.current) cancelAnimationFrame(animRef.current);

    const ease = (p: number) => (p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p);

    const step = (now: number) => {
      const p = clamp((now - start) / duration, 0, 1);
      const e = ease(p);
      setTransform(
        startX + (targetX - startX) * e,
        startY,
        startScale + (targetScale - startScale) * e,
      );
      if (p < 1) animRef.current = requestAnimationFrame(step);
      else animRef.current = null;
    };
    animRef.current = requestAnimationFrame(step);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onScrollH = useCallback((fraction: number) => {
    const b = getBounds();
    const x = b.maxX - fraction * (b.maxX - b.minX);
    setTransform(x, t.current.y, t.current.scale);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onScrollV = useCallback((fraction: number) => {
    const b = getBounds();
    const y = b.maxY - fraction * (b.maxY - b.minY);
    setTransform(t.current.x, y, t.current.scale);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive reactive scale from zoomPct
  const scale = minScale + (clamp(zoomPct, 0, 100) / 100) * (maxScale - minScale);

  return {
    viewportRef,
    contentRef,
    scale,
    zoomPercentage: zoomPct,
    setZoomPercentage,
    panToContent,
    resetView,
    remeasure,
    scrollbar: {
      hTrackRef,
      vTrackRef,
      hThumbRef,
      vThumbRef,
      onScrollH,
      onScrollV,
    },
  };
}
