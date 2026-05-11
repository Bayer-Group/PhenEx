import { FC, useRef, useState, useLayoutEffect } from 'react';
import { type CohortClassified, type KdeCurve } from '../../types';
import { useBarHoverStore } from './useBarHoverStore';
import { NumericChartFrame } from './NumericChartFrame';
import styles from './KDEChartCellRenderer.module.css';

/* ── Layout constants ────────────────────────────────────────────────── */

const PAD = 4;
const STROKE_PAD = 2;
const DEFAULT_W = 300;
const MARGIN_BOTTOM = 4;

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
  const W = widthProp ?? DEFAULT_W;
  const PLOT_W = W - PAD * 2;
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

  const plotH = Math.max(10, containerH - MARGIN_BOTTOM - STROKE_PAD);
  const svgH = STROKE_PAD + plotH;

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
        {containerH > 0 && (
          <svg width={W} height={svgH} className={styles.kdeSvg}>
            {curves.map((c) => {
              const idx = cohortData.findIndex((cd) => cd.name === c.cohortName);
              const dimmed = activeIndex !== null && activeIndex !== idx;
              return (
                <path
                  key={c.cohortName}
                  className={styles.kdePath}
                  d={buildPath(c.curve, PLOT_W, plotH, PAD, STROKE_PAD, gMin, gMax)}
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
