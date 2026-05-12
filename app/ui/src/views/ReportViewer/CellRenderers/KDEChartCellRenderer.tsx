import { FC, useRef, useState, useLayoutEffect } from 'react';
import { type CohortClassified, type KdeCurve } from '../types';
import { useBarHoverStore } from './useBarHoverStore';
import { NumericChartFrame } from './NumericChartFrame';
import styles from './KDEChartCellRenderer.module.css';

/* ── Layout constants ────────────────────────────────────────────────── */

const PAD = 2;
const STROKE_PAD = 2;
const DEFAULT_W = 300;
const MARGIN_BOTTOM = 30;

/* ── Helpers ─────────────────────────────────────────────────────────── */

function buildPath(
  curve: KdeCurve,
  plotW: number,
  h: number,
  pad: number,
  strokePad: number,
  xMin: number,
  xMax: number,
  clipMin?: number | null,
  clipMax?: number | null,
): string {
  const { x, y } = curve;
  if (!x.length) return '';
  const xRange = xMax - xMin || 1;
  const sx = (v: number) => pad + ((v - xMin) / xRange) * plotW;
  const sy = (v: number) => strokePad + h - (v / 100) * h;

  // Interpolate y at a given xVal between two curve points
  const lerp = (xVal: number, i0: number, i1: number) => {
    const t = (xVal - x[i0]) / (x[i1] - x[i0] || 1);
    return y[i0] + t * (y[i1] - y[i0]);
  };

  // Collect points within [clipMin, clipMax]
  const pts: [number, number][] = [];
  const lo = clipMin ?? -Infinity;
  const hi = clipMax ?? Infinity;

  for (let i = 0; i < x.length; i++) {
    const prev = i > 0 ? x[i - 1] : null;

    // Entering the range: interpolate entry point
    if (prev != null && prev < lo && x[i] >= lo) {
      pts.push([sx(lo), sy(lerp(lo, i - 1, i))]);
    }

    if (x[i] >= lo && x[i] <= hi) {
      pts.push([sx(x[i]), sy(y[i])]);
    }

    // Exiting the range: interpolate exit point and stop
    if (x[i] > hi && prev != null && prev <= hi) {
      pts.push([sx(hi), sy(lerp(hi, i - 1, i))]);
      break;
    }
  }

  if (!pts.length) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    d += `L${pts[i][0]},${pts[i][1]}`;
  }
  return d;
}

/* ── Component ───────────────────────────────────────────────────────── */

interface KDEChartCellRendererProps {
  name: string;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
  xMin?: number;
  xMax?: number;
  width?: number;
  showTicks?: boolean;
}

export const KDEChartCellRenderer: FC<KDEChartCellRendererProps> = ({
  name,
  cohortData,
  kdeData,
  xMin: xMinProp,
  xMax: xMaxProp,
  width: widthProp,
  showTicks = true,
}) => {
  const { activeIndex } = useBarHoverStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerH, setContainerH] = useState(0);
  const [containerW, setContainerW] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerH(entry.contentRect.height);
      setContainerW(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = widthProp ?? (containerW || DEFAULT_W);
  const PLOT_W = W - PAD * 2;

  const plotH = Math.max(10, containerH - MARGIN_BOTTOM - STROKE_PAD * 2);

  const svgH = STROKE_PAD + plotH + STROKE_PAD;

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
  if (xMinProp != null) gMin = xMinProp;
  if (xMaxProp != null) gMax = xMaxProp;

  if (curves.length === 0) {
    return <div className={styles.kdeEmpty}>no distribution</div>;
  }

  return (
    <NumericChartFrame xMin={gMin} xMax={gMax} width={W} showTicks={showTicks}>
      <div ref={containerRef} className={styles.container} style={{ paddingBottom: MARGIN_BOTTOM }}>
        {containerH > 0 && containerW > 0 && (
          <svg width="100%" height={svgH} viewBox={`0 0 ${W} ${svgH}`} preserveAspectRatio="none" className={styles.kdeSvg}>
            {curves.map((c, ci) => {
              const idx = cohortData.findIndex((cd) => cd.name === c.cohortName);
              const dimmed = activeIndex !== null && activeIndex !== idx;
              const cd = cohortData[idx];
              const row = cd?.data.rows.find((r) => r.Name === name);
              return (
                <path
                  key={c.cohortName}
                  className={styles.kdePath}
                  d={buildPath(c.curve, PLOT_W, plotH, PAD, STROKE_PAD, gMin, gMax, row?.Min, row?.Max)}
                  fill="none"
                  stroke={c.color}
                  opacity={dimmed ? 0.15 : 0.85}
                />
              );
            })}
          </svg>
        )}
      </div>
    </NumericChartFrame>
  );
};
