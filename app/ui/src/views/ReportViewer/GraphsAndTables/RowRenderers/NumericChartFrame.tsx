import { FC, ReactNode, useRef, useState, useEffect } from 'react';
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

  // Start from a nice value at or below min
  const first = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = first; v <= max - step * 0.01; v += step) {
    ticks.push(Math.round(v * 1e6) / 1e6);
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
  children: ReactNode;
}

export const NumericChartFrame: FC<NumericChartFrameProps> = ({
  xMin,
  xMax,
  width: widthProp,
  showTicks = true,
  clippedLeft,
  clippedRight,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);

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

  return (
    <div ref={containerRef} className={styles.frame}>
      {width > 0 && (
        <>
      {/* Grid lines */}
      <div className={styles.gridOverlay} style={{ left: 0, width }}>
        {ticks.map((t) => (
          <div key={t} className={styles.gridLine} style={{ left: px(t) }} />
        ))}
      </div>

      {/* Tick labels */}
      {showTicks && (
        <div className={styles.headerRow}>
          {ticks.map((t) => (
            <span key={t} className={styles.headerTick} style={{ left: px(t) }}>
              {fmtTick(t)}
            </span>
          ))}

          {/* Clipped-edge hatch ticks — anchored to the cut boundary, not centered */}
          {clippedLeft && (
            <span className={`${styles.headerTick} ${styles.clipTick}`} style={{ left: px(xMin), transform: 'none' }}>
              <span className={styles.clipHatchBar} />
              {fmtTick(clippedLeft.value)}
            </span>
          )}
          {clippedRight && (
            <span className={`${styles.headerTick} ${styles.clipTick}`} style={{ left: 'auto', right: width - px(xMax), transform: 'none' }}>
              {fmtTick(clippedRight.value)}
              <span className={styles.clipHatchBar} />
            </span>
          )}
        </div>
      )}

      {/* Chart content */}
      <div className={styles.content}>
        {children}
      </div>
        </>
      )}
    </div>
  );
};
