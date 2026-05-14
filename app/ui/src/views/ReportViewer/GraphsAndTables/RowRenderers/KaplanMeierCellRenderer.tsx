import { FC, useRef, useState, useLayoutEffect, useMemo } from 'react';
import { type TimeToEventRow } from '../../types';
import { useBarHoverStore } from './useBarHoverStore';
import styles from './KaplanMeierCellRenderer.module.css';

/* ── Configurable risk table timepoints ──────────────────────────────── */

/** Default timepoints (days) for the risk table below the KM curve. */
export const DEFAULT_RISK_TIMEPOINTS = [30, 60, 90, 120, 180, 365];

/* ── Layout constants ────────────────────────────────────────────────── */

const PAD = 4;
const STROKE_PAD = 2;
const W = 300;
const PLOT_W = W - PAD * 2;
const MARGIN_BOTTOM = 4;
const HEADER_H = 14;
const RISK_ROW_H = 13;
const RISK_LABEL_W = 52;

/* ── Types ───────────────────────────────────────────────────────────── */

interface KMCurve {
  color: string;
  cohortName: string;
  steps: TimeToEventRow[];
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

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
    d += `H${sx(steps[i].Timeline)}`;
    d += `V${sy(steps[i].Survival_Probability)}`;
  }
  d += `H${sx(xMax)}`;
  return d;
}

/** Build a closed CI band polygon: upper forward, then lower backward. */
function buildCIBand(
  steps: TimeToEventRow[],
  plotW: number,
  plotH: number,
  pad: number,
  strokePad: number,
  xMax: number,
): string {
  if (!steps.length || steps[0].CI_Lower == null) return '';
  const sx = (t: number) => pad + (t / xMax) * plotW;
  const sy = (p: number) => strokePad + plotH - p * plotH;

  // Upper path forward (step function)
  let upper = `M${sx(steps[0].Timeline)},${sy(steps[0].CI_Upper)}`;
  for (let i = 1; i < steps.length; i++) {
    upper += `H${sx(steps[i].Timeline)}V${sy(steps[i].CI_Upper)}`;
  }
  upper += `H${sx(xMax)}`;

  // Lower path backward (step function, reversed)
  const lastIdx = steps.length - 1;
  let lower = `L${sx(xMax)},${sy(steps[lastIdx].CI_Lower)}`;
  for (let i = lastIdx; i > 0; i--) {
    lower += `H${sx(steps[i].Timeline)}V${sy(steps[i - 1].CI_Lower)}`;
  }
  lower += `H${sx(steps[0].Timeline)}Z`;

  return upper + lower;
}

/** Pick nice tick values for the x-axis. */
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

/** Look up the last value at or before a given timepoint. */
function lookupAtTime(steps: TimeToEventRow[], t: number, field: keyof TimeToEventRow): number | null {
  let val: number | null = null;
  for (const row of steps) {
    if (row.Timeline > t) break;
    val = row[field] as number;
  }
  return val;
}

/** Sum a cumulative field (Events or Censored) up to a timepoint. */
function cumFieldAtTime(steps: TimeToEventRow[], t: number, field: 'Events' | 'Censored'): number {
  let sum = 0;
  for (const row of steps) {
    if (row.Timeline > t) break;
    sum += row[field] ?? 0;
  }
  return sum;
}

/** Filter risk timepoints to those within the data range. */
function filterTimepoints(timepoints: number[], xMax: number): number[] {
  return timepoints.filter((t) => t <= xMax);
}

/* ── Risk table row definitions ──────────────────────────────────────── */

interface RiskField {
  label: string;
  getValue: (steps: TimeToEventRow[], t: number) => string;
}

const RISK_FIELDS: RiskField[] = [
  { label: 'At risk',    getValue: (steps, t) => { const v = lookupAtTime(steps, t, 'At_Risk'); return v != null ? String(v) : ''; } },
  { label: 'Events',     getValue: (steps, t) => String(cumFieldAtTime(steps, t, 'Events')) },
  { label: 'Censored',   getValue: (steps, t) => String(cumFieldAtTime(steps, t, 'Censored')) },
];

/* ── Component ───────────────────────────────────────────────────────── */

interface KaplanMeierCellRendererProps {
  curves: KMCurve[];
  /** Override the default risk table timepoints. */
  riskTimepoints?: number[];
}

export const KaplanMeierCellRenderer: FC<KaplanMeierCellRendererProps> = ({
  curves,
  riskTimepoints = DEFAULT_RISK_TIMEPOINTS,
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

  // Global max timeline across all curves
  let xMax = 0;
  for (const c of curves) {
    for (const s of c.steps) {
      if (s.Timeline > xMax) xMax = s.Timeline;
    }
  }
  if (xMax === 0) xMax = 365;

  // Filter timepoints to data range
  const activeTimepoints = useMemo(() => filterTimepoints(riskTimepoints, xMax), [riskTimepoints, xMax]);

  // Check if any curve has CI data
  const hasCI = curves.some((c) => c.steps.length > 0 && c.steps[0].CI_Lower != null);

  // Risk table height
  const riskTableH = activeTimepoints.length > 0
    ? RISK_ROW_H + curves.length * RISK_FIELDS.length * RISK_ROW_H
    : 0;

  const plotH = Math.max(10, containerH - MARGIN_BOTTOM - HEADER_H - STROKE_PAD - riskTableH);
  const svgH = STROKE_PAD + plotH;

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

      {/* KM step curves with CI bands */}
      <div className={styles.plotArea}>
        {containerH > 0 && (
          <svg width={W} height={svgH} className={styles.kmSvg}>
            {curves.map((c, i) => {
              const dimmed = activeIndex !== null && activeIndex !== i;
              const ciPath = hasCI ? buildCIBand(c.steps, PLOT_W, plotH, PAD, STROKE_PAD, xMax) : '';
              return (
                <g key={c.cohortName} opacity={dimmed ? 0.15 : 1}>
                  {ciPath && (
                    <path d={ciPath} fill={c.color} fillOpacity={0.12} stroke="none" />
                  )}
                  <path
                    d={buildStepPath(c.steps, PLOT_W, plotH, PAD, STROKE_PAD, xMax)}
                    fill="none"
                    stroke={c.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.85}
                  />
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Risk table */}
      {activeTimepoints.length > 0 && (
        <div className={styles.riskTable}>
          {/* Timepoint header row */}
          <div className={styles.riskRow}>
            <div className={styles.riskLabel} />
            {activeTimepoints.map((t) => (
              <div key={t} className={styles.riskValue} style={{ left: toPixel(t) }}>{t}</div>
            ))}
          </div>

          {/* Per-cohort risk rows */}
          {curves.map((c, ci) => {
            const dimmed = activeIndex !== null && activeIndex !== ci;
            return (
              <div key={c.cohortName} className={styles.riskCohortBlock} style={{ opacity: dimmed ? 0.25 : 1 }}>
                {RISK_FIELDS.map((field, fi) => (
                  <div key={field.label} className={styles.riskRow}>
                    <div
                      className={styles.riskLabel}
                      style={fi === 0 && curves.length > 1 ? { color: c.color, fontWeight: 600 } : undefined}
                    >
                      {curves.length > 1 ? (fi === 0 ? c.cohortName : field.label) : field.label}
                    </div>
                    {activeTimepoints.map((t) => (
                      <div
                        key={t}
                        className={styles.riskValue}
                        style={{ left: toPixel(t), color: fi === 0 ? c.color : undefined }}
                      >
                        {field.getValue(c.steps, t)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export type { KMCurve };
