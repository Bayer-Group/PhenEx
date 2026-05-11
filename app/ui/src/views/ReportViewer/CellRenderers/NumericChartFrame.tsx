import { FC, ReactNode } from 'react';
import styles from './NumericChartFrame.module.css';

/* ── Shared axis helpers (exported for reuse) ────────────────────────── */

const PAD = 4;

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

interface NumericChartFrameProps {
  xMin: number;
  xMax: number;
  width: number;
  showTicks?: boolean;
  children: ReactNode;
}

export const NumericChartFrame: FC<NumericChartFrameProps> = ({
  xMin,
  xMax,
  width,
  showTicks = true,
  children,
}) => {
  const ticks = niceTicks(xMin, xMax);
  const px = (v: number) => toPixel(v, xMin, xMax, width);

  return (
    <div className={styles.frame}>
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
        </div>
      )}

      {/* Chart content */}
      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
};
