import { FC, useRef, useState, useCallback, useMemo } from 'react';
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
const Y_AXIS_W = 28;
const PLOT_LEFT = Y_AXIS_W + PAD;
const PLOT_RIGHT = PAD;
const PLOT_W = W - PLOT_LEFT - PLOT_RIGHT;
const MARGIN_BOTTOM = 4;
const HEADER_H = 14;
const RISK_ROW_H = 13;
const COMPACT_MIN_PLOT_H = 96;
const FULL_MIN_PLOT_H = 160;
const Y_TICKS = [0, 0.25, 0.5, 0.75, 1] as const;

/* ── Types ───────────────────────────────────────────────────────────── */

interface KMCurve {
  color: string;
  cohortName: string;
  dashArray?: string;
  steps: TimeToEventRow[];
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

/** Build a step-function SVG path from KM data. */
function buildStepPath(
  steps: TimeToEventRow[],
  plotW: number,
  plotH: number,
  plotLeft: number,
  strokePad: number,
  xMax: number,
): string {
  if (!steps.length) return '';
  const sx = (t: number) => plotLeft + (t / xMax) * plotW;
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
  plotLeft: number,
  strokePad: number,
  xMax: number,
): string {
  if (!steps.length || steps[0].CI_Lower == null) return '';
  const sx = (t: number) => plotLeft + (t / xMax) * plotW;
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

/** Look up the row at or just before a given time. */
function rowAtTime(steps: TimeToEventRow[], t: number): TimeToEventRow | null {
  let row: TimeToEventRow | null = null;
  for (const r of steps) {
    if (r.Timeline > t) break;
    row = r;
  }
  return row;
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

function formatPercentTick(value: number): string {
  return `${Math.round(value * 100)}%`;
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
  /** 'compact' for row renderers (small, no risk table/hover); 'full' for modal view. */
  mode?: 'compact' | 'full';
  /** Override the default risk table timepoints (full mode only). */
  riskTimepoints?: number[];
}

export const KaplanMeierCellRenderer: FC<KaplanMeierCellRendererProps> = ({
  curves,
  mode = 'compact',
  riskTimepoints = DEFAULT_RISK_TIMEPOINTS,
}) => {
  const isFull = mode === 'full';
  const { activeIndex } = useBarHoverStore();
  const plotAreaRef = useRef<HTMLDivElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPixelX, setHoverPixelX] = useState(0);

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

  // Check if any curve has CI data (only rendered in full mode)
  const hasCI = isFull && curves.some((c) => c.steps.length > 0 && c.steps[0].CI_Lower != null);

  // Risk table height (full mode only)
  const riskTableH = isFull && activeTimepoints.length > 0
    ? RISK_ROW_H + curves.length * RISK_FIELDS.length * RISK_ROW_H
    : 0;

  const minPlotH = isFull ? FULL_MIN_PLOT_H : COMPACT_MIN_PLOT_H;
  const plotH = minPlotH;
  const svgH = STROKE_PAD + plotH;

  const ticks = niceTicks(xMax);
  // In full mode, gridlines align to risk timepoints; in compact mode, use auto ticks
  const gridTicks = isFull ? activeTimepoints : ticks;
  const toPixel = (t: number) => PLOT_LEFT + (t / xMax) * PLOT_W;
  const toYPixel = (p: number) => STROKE_PAD + plotH - p * plotH;
  const toTime = (px: number) => Math.max(0, Math.min(xMax, ((px - PLOT_LEFT) / PLOT_W) * xMax));

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = plotAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    setHoverPixelX(px);
    setHoverTime(toTime(px));
  }, [xMax]);

  const handleMouseLeave = useCallback(() => setHoverTime(null), []);

  // Build tooltip data when hovering (full mode only)
  const hoverData = useMemo(() => {
    if (!isFull || hoverTime == null) return null;
    return curves.map((c) => {
      const row = rowAtTime(c.steps, hoverTime);
      return {
        color: c.color,
        cohortName: c.cohortName,
        survival: row?.Survival_Probability ?? null,
        atRisk: row?.At_Risk ?? null,
        events: cumFieldAtTime(c.steps, hoverTime, 'Events'),
        censored: cumFieldAtTime(c.steps, hoverTime, 'Censored'),
      };
    });
  }, [isFull, hoverTime, curves]);

  if (curves.length === 0) {
    return <div className={styles.kmEmpty}>no data</div>;
  }

  const containerClass = isFull ? `${styles.container} ${styles.full}` : styles.container;
  const containerStyle = {
    paddingBottom: MARGIN_BOTTOM,
    minHeight: HEADER_H + svgH + riskTableH + MARGIN_BOTTOM,
  };

  return (
    <div className={containerClass} style={containerStyle}>
      {/* Tick labels header */}
      <div className={styles.headerRow}>
        {gridTicks.map((t) => (
          <span key={t} className={styles.headerTick} style={{ left: toPixel(t) }}>
            {t}
          </span>
        ))}
      </div>

      {/* KM step curves with CI bands */}
      <div className={styles.plotArea} ref={plotAreaRef} onMouseMove={isFull ? handleMouseMove : undefined} onMouseLeave={isFull ? handleMouseLeave : undefined}>
        <svg width={W} height={svgH} className={styles.kmSvg}>
          {Y_TICKS.map((tick) => (
            <g key={tick}>
              <line
                x1={PLOT_LEFT}
                x2={PLOT_LEFT + PLOT_W}
                y1={toYPixel(tick)}
                y2={toYPixel(tick)}
                className={styles.gridLineHorizontal}
              />
              <text
                x={Y_AXIS_W - 2}
                y={toYPixel(tick) + 3}
                textAnchor="end"
                className={styles.yTickLabel}
              >
                {formatPercentTick(tick)}
              </text>
            </g>
          ))}
          {gridTicks.map((tick) => (
            <line
              key={tick}
              x1={toPixel(tick)}
              x2={toPixel(tick)}
              y1={STROKE_PAD}
              y2={STROKE_PAD + plotH}
              className={styles.gridLineVertical}
            />
          ))}
          <line
            x1={PLOT_LEFT}
            x2={PLOT_LEFT}
            y1={STROKE_PAD}
            y2={STROKE_PAD + plotH}
            className={styles.axisLine}
          />
          <line
            x1={PLOT_LEFT}
            x2={PLOT_LEFT + PLOT_W}
            y1={STROKE_PAD + plotH}
            y2={STROKE_PAD + plotH}
            className={styles.axisLine}
          />
          {curves.map((c, i) => {
            const dimmed = activeIndex !== null && activeIndex !== i;
            const ciPath = hasCI ? buildCIBand(c.steps, PLOT_W, plotH, PLOT_LEFT, STROKE_PAD, xMax) : '';
            return (
              <g key={c.cohortName} opacity={dimmed ? 0.15 : 1}>
                {ciPath && (
                  <path d={ciPath} fill={c.color} fillOpacity={0.12} stroke="none" />
                )}
                <path
                  d={buildStepPath(c.steps, PLOT_W, plotH, PLOT_LEFT, STROKE_PAD, xMax)}
                  fill="none"
                  stroke={c.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={c.dashArray}
                  opacity={0.85}
                />
              </g>
            );
          })}
        </svg>

        {/* Hover crosshair + tooltip (full mode only) */}
        {isFull && hoverTime != null && hoverData && (
          <>
            <div className={styles.crosshairLine} style={{ left: hoverPixelX, height: svgH }} />
            <div
              className={styles.tooltip}
              style={{ left: hoverPixelX > W / 2 ? hoverPixelX - 4 : hoverPixelX + 4, transform: hoverPixelX > W / 2 ? 'translateX(-100%)' : undefined }}
            >
              <div className={styles.tooltipHeader}>Day {Math.round(hoverTime)}</div>
              {hoverData.map((d) => (
                <div key={d.cohortName} className={styles.tooltipRow}>
                  <span className={styles.tooltipDot} style={{ backgroundColor: d.color }} />
                  <span className={styles.tooltipSurv}>{d.survival != null ? (d.survival * 100).toFixed(1) + '%' : '–'}</span>
                  <span className={styles.tooltipDetail}>{d.cohortName}: n={d.atRisk ?? '–'} e={d.events} c={d.censored}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Risk table (full mode only) */}
      {isFull && activeTimepoints.length > 0 && (
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
