import { FC, useRef, useState, useLayoutEffect } from 'react';
import { type TimeToEventRow } from '../../types';
import { useBarHoverStore } from './useBarHoverStore';
import styles from './KaplanMeierCellRenderer.module.css';

/* ── Layout constants ────────────────────────────────────────────────── */

const PAD = 4;
const STROKE_PAD = 2;
const W = 300;
const PLOT_W = W - PAD * 2;
const MARGIN_BOTTOM = 4;
const HEADER_H = 14;

/* ── Helpers ─────────────────────────────────────────────────────────── */

interface KMCurve {
  color: string;
  cohortName: string;
  steps: TimeToEventRow[];
}

/** Build a step-function SVG path from KM data. */
function buildStepPath(
  steps: TimeToEventRow[],
  plotW: number,
  plotH: number,
  pad: number,
  strokePad: number,
  xMax: number,
): string {
  if (!steps.length) return '';
  const sx = (t: number) => pad + (t / xMax) * plotW;
  const sy = (p: number) => strokePad + plotH - p * plotH;

  let d = `M${sx(steps[0].Timeline)},${sy(steps[0].Survival_Probability)}`;
  for (let i = 1; i < steps.length; i++) {
    // Horizontal to new time, then vertical to new probability
    d += `H${sx(steps[i].Timeline)}`;
    d += `V${sy(steps[i].Survival_Probability)}`;
  }
  // Extend to xMax at last probability
  d += `H${sx(xMax)}`;
  return d;
}

/** Pick nice tick values for the x-axis (time in days). */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const rawStep = max / 6;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / mag;
  let step: number;
  if (residual <= 1.5) step = mag;
  else if (residual <= 3.5) step = 2 * mag;
  else if (residual <= 7.5) step = 5 * mag;
  else step = 10 * mag;
  if (max >= 10 && step < 5) step = 5;

  const ticks: number[] = [0];
  for (let v = step; v <= max + step * 0.01; v += step) {
    ticks.push(Math.round(v));
  }
  return ticks;
}

/* ── Component ───────────────────────────────────────────────────────── */

interface KaplanMeierCellRendererProps {
  curves: KMCurve[];
}

export const KaplanMeierCellRenderer: FC<KaplanMeierCellRendererProps> = ({
  curves,
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

  const plotH = Math.max(10, containerH - MARGIN_BOTTOM - HEADER_H - STROKE_PAD);
  const svgH = STROKE_PAD + plotH;

  // Global max timeline across all curves for this outcome
  let xMax = 0;
  for (const c of curves) {
    for (const s of c.steps) {
      if (s.Timeline > xMax) xMax = s.Timeline;
    }
  }
  if (xMax === 0) xMax = 365;

  const ticks = niceTicks(xMax);

  const toPixel = (t: number) => PAD + (t / xMax) * PLOT_W;

  if (curves.length === 0) {
    return <div className={styles.kmEmpty}>no data</div>;
  }

  return (
    <div className={styles.container} ref={containerRef} style={{ paddingBottom: MARGIN_BOTTOM }}>
      {/* Tick labels header */}
      <div className={styles.headerRow}>
        {ticks.map((t) => (
          <span key={t} className={styles.headerTick} style={{ left: toPixel(t) }}>
            {t}
          </span>
        ))}
      </div>

      {/* Grid lines */}
      <div className={styles.gridOverlay} style={{ left: 0, width: W }}>
        {ticks.map((t) => (
          <div key={t} className={styles.gridLine} style={{ left: toPixel(t) }} />
        ))}
      </div>

      {/* KM step curves */}
      <div className={styles.plotArea}>
        {containerH > 0 && (
          <svg width={W} height={svgH} className={styles.kmSvg}>
            {curves.map((c, i) => {
              const dimmed = activeIndex !== null && activeIndex !== i;
              return (
                <path
                  key={c.cohortName}
                  d={buildStepPath(c.steps, PLOT_W, plotH, PAD, STROKE_PAD, xMax)}
                  fill="none"
                  stroke={c.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={dimmed ? 0.15 : 0.85}
                />
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
};

export type { KMCurve };
