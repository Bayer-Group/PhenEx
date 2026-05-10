import { FC, useRef, useState, useLayoutEffect } from 'react';
import { type CohortClassified, type KdeCurve } from '../../types';
import { useBarHoverStore } from './useBarHoverStore';
import styles from './KDEChartCellRenderer.module.css';

/* ── Layout constants ────────────────────────────────────────────────── */

const PAD = 4;
const STROKE_PAD = 2; // vertical padding so strokes aren't clipped at top
const W = 300;
const PLOT_W = W - PAD * 2;
const MARGIN_BOTTOM = 4;
const HEADER_H = 25;
const AXIS_H = 16;

/* ── Helpers ─────────────────────────────────────────────────────────── */

function buildPath(curve: KdeCurve, plotW: number, h: number, pad: number, strokePad: number, xMin: number, xMax: number): string {
  const { x, y } = curve;
  if (!x.length) return '';
  const xRange = xMax - xMin || 1;
  const sx = (v: number) => pad + ((v - xMin) / xRange) * plotW;
  const sy = (v: number) => strokePad + h - (v / 100) * h;
  let d = `M${sx(x[0])},${sy(y[0])}`;
  for (let i = 1; i < x.length; i++) {
    d += `L${sx(x[i])},${sy(y[i])}`;
  }
  return d;
}

/** Pick "nice" tick values divisible by 5 or 10 spanning the data range. */
function niceTicks(min: number, max: number): number[] {
  const range = max - min;
  if (range <= 0) return [min];

  // Target ~5-7 ticks; pick step as a "nice" number (multiples of 5 or 10)
  const rawStep = range / 6;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / mag;
  let step: number;
  if (residual <= 1.5) step = mag;
  else if (residual <= 3.5) step = 2 * mag;
  else if (residual <= 7.5) step = 5 * mag;
  else step = 10 * mag;

  // Ensure step is at least 5 when range ≥ 10 (keep integer ticks clean)
  if (range >= 10 && step < 5) step = 5;

  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = first; v <= max + step * 0.01; v += step) {
    ticks.push(Math.round(v * 1e6) / 1e6); // avoid float noise
  }
  return ticks;
}

function fmtTick(v: number): string {
  if (Math.abs(v) < 10 && v % 1 !== 0) return v.toFixed(1);
  return Math.round(v).toString();
}

/* ── Component ───────────────────────────────────────────────────────── */

interface KDEChartCellRendererProps {
  name: string;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
}

export const KDEChartCellRenderer: FC<KDEChartCellRendererProps> = ({
  name,
  cohortData,
  kdeData,
}) => {
  const { activeIndex } = useBarHoverStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerH, setContainerH] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerH(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const plotH = Math.min(100, Math.max(10, containerH - MARGIN_BOTTOM - HEADER_H - AXIS_H - STROKE_PAD));
  const svgH = STROKE_PAD + plotH + AXIS_H;

  const curves = cohortData
    .map((cd) => {
      const curve = kdeData[cd.name]?.[name];
      if (!curve) return null;
      return { color: cd.color, curve, cohortName: cd.name };
    })
    .filter(Boolean) as { color: string; curve: KdeCurve; cohortName: string }[];

  // Global x range across all curves
  let gMin = Infinity, gMax = -Infinity;
  for (const c of curves) {
    const xs = c.curve.x;
    if (xs.length) {
      if (xs[0] < gMin) gMin = xs[0];
      if (xs[xs.length - 1] > gMax) gMax = xs[xs.length - 1];
    }
  }
  if (!isFinite(gMin)) { gMin = 0; gMax = 1; }

  const ticks = niceTicks(gMin, gMax);

  // Convert a data value to pixel x
  const toPixel = (v: number) => {
    const xRange = gMax - gMin || 1;
    return PAD + ((v - gMin) / xRange) * PLOT_W;
  };

  if (curves.length === 0) {
    return <div className={styles.kdeEmpty}>no distribution</div>;
  }

  return (
    <div className={styles.container} ref={containerRef} style={{ paddingBottom: MARGIN_BOTTOM }}>
      {/* Tick labels header */}
      <div className={styles.headerRow}>
        {ticks.map((t) => (
          <span key={t} className={styles.headerTick} style={{ left: toPixel(t) }}>
            {fmtTick(t)}
          </span>
        ))}
      </div>

      {/* Grid lines */}
      <div className={styles.gridOverlay} style={{ left: 0, width: W }}>
        {ticks.map((t) => (
          <div key={t} className={styles.gridLine} style={{ left: toPixel(t) }} />
        ))}
      </div>

      {/* KDE curves + x-axis ticks */}
      <div className={styles.plotArea}>
        {containerH > 0 && (
          <svg width={W} height={svgH} className={styles.kdeSvg}>
            {curves.map((c) => {
              const idx = cohortData.findIndex((cd) => cd.name === c.cohortName);
              const dimmed = activeIndex !== null && activeIndex !== idx;
              return (
                <path
                  key={c.cohortName}
                  d={buildPath(c.curve, PLOT_W, plotH, PAD, STROKE_PAD, gMin, gMax)}
                  fill="none"
                  stroke={c.color}
                  strokeWidth={2}                  strokeLinecap="round"
                  strokeLinejoin="round"                  opacity={dimmed ? 0.15 : 0.85}
                />
              );
            })}
            {/* x-axis ticks */}
            {/* {ticks.map((t) => {
              const px = toPixel(t);
              return (
                <g key={t}>
                  <line x1={px} y1={STROKE_PAD + plotH} x2={px} y2={STROKE_PAD + plotH + 4} stroke="#999" strokeWidth={0.5} />
                  <text x={px} y={STROKE_PAD + plotH + 14} textAnchor="middle" fontSize={9} fill="#999">
                    {Math.round(t)}
                  </text>
                </g>
              );
            })} */}
          </svg>
        )}
      </div>
    </div>
  );
};
