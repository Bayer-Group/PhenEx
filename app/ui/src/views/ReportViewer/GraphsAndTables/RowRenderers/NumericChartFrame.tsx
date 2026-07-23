import { FC, ReactNode, useRef, useState, useEffect, useCallback } from 'react';
import styles from './NumericChartFrame.module.css';

/* ── Shared axis helpers (exported for reuse) ────────────────────────── */

const PAD = 2;

export function niceTicks(min: number, max: number): number[] {
  const range = max - min;
  if (range <= 0) return [min];

  const rawStep = range / 6;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / mag;
  let step: number;
  if (residual <= 1.5) step = mag;
  else if (residual <= 3.5) step = 2 * mag;
  else if (residual <= 7.5) step = 5 * mag;
  else step = 10 * mag;

  if (range >= 10 && step < 5) step = 5;

  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = first; v <= max + step * 0.01; v += step) {
    const rounded = Math.round(v * 1e6) / 1e6;
    if (rounded >= min && rounded <= max) ticks.push(rounded);
  }
  return ticks;
}

export function fmtTick(v: number): string {
  if (Math.abs(v) < 10 && v % 1 !== 0) return v.toFixed(1);
  return Math.round(v).toString();
}

export function toPixel(v: number, xMin: number, xMax: number, width: number): number {
  const plotW = width - PAD * 2;
  const xRange = xMax - xMin || 1;
  return PAD + ((v - xMin) / xRange) * plotW;
}

/* ── Frame component ─────────────────────────────────────────────────── */

interface ClipEdge {
  /** The true (unclipped) axis value that was cropped away. */
  value: number;
}

interface NumericChartFrameProps {
  xMin: number;
  xMax: number;
  width?: number;
  showTicks?: boolean;
  /** If the left edge was clipped, provide the true minimum so a hatch tick is shown. */
  clippedLeft?: ClipEdge;
  /** If the right edge was clipped, provide the true maximum so a hatch tick is shown. */
  clippedRight?: ClipEdge;
  /** Horizontal inset (px) applied to grid lines and ticks so they align with
   *  padded content (e.g. fill-width box plots that reserve edge padding). */
  insetX?: number;
  children: ReactNode;
}

export const NumericChartFrame: FC<NumericChartFrameProps> = ({
  xMin,
  xMax,
  width: widthProp,
  showTicks = true,
  clippedLeft: _clippedLeft,
  clippedRight: _clippedRight,
  insetX = 0,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True once the delay has fired — crosshair follows mouse until leave.
  const followingRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const width = widthProp ?? containerW;
  const ticks = niceTicks(xMin, xMax);
  const px = (v: number) => toPixel(v, xMin, xMax, width);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (followingRef.current) {
      // Already past the delay — track the mouse directly.
      setHover(pos);
      return;
    }
    // Still in the initial delay: reset the timer on each move.
    if (hoverTimerRef.current !== null) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      followingRef.current = true;
      setHover(pos);
    }, 400); // SET TIME DELAY HERE
  }, []);

  const dismissCrosshair = useCallback(() => {
    if (hoverTimerRef.current !== null) clearTimeout(hoverTimerRef.current);
    followingRef.current = false;
    setHover(null);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') dismissCrosshair(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dismissCrosshair]);

  const hoverValue =
    hover !== null
      ? xMin + ((hover.x - PAD - insetX) / (width - PAD * 2)) * (xMax - xMin)
      : null;

  return (
    <div
      ref={containerRef}
      className={styles.frame}
      onMouseMove={handleMouseMove}
      onMouseLeave={dismissCrosshair}
    >
      {width > 0 && (
        <>
          {/* Grid lines */}
          <div className={styles.gridOverlay} style={{ left: insetX, width }}>
            {ticks.map((t) => (
              <div key={t} className={styles.gridLine} style={{ left: px(t) }} />
            ))}
          </div>

          {/* Hover crosshair */}
          {hover !== null && hoverValue !== null && (
            <div className={styles.hoverLine} style={{ left: hover.x }}>
              <span className={styles.hoverLabel} style={{ top: hover.y }}>
                {fmtTick(hoverValue)}
              </span>
            </div>
          )}

          {/* Tick labels */}
          {showTicks && (
            <div className={styles.headerRow}>
              {ticks.map((t) => (
                <span key={t} className={styles.headerTick} style={{ left: px(t) + insetX }}>
                  {fmtTick(t)}
                </span>
              ))}
            </div>
          )}

          {/* Chart content */}
          <div className={styles.content}>{children}</div>
        </>
      )}
    </div>
  );
};
