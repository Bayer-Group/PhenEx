import { FC, useRef, useState, useCallback, useMemo, useLayoutEffect } from 'react';
import { type TimeToEventRow } from '../../types';
import { useBarHoverStore } from './useBarHoverStore';
import styles from './KaplanMeierCellRenderer.module.css';

/* ── Configurable risk table timepoints ──────────────────────────────── */

/** Default timepoints (days) for the risk table below the KM curve. */
export const DEFAULT_RISK_TIMEPOINTS = [30, 60, 90, 120, 180, 365];

/* ── Layout constants ────────────────────────────────────────────────── */

const STROKE_PAD = 2;
const COMPACT_W = 300;
const Y_AXIS_W = 36;
const X_AXIS_H = 14;
const RISK_ROW_H = 13;
const COMPACT_PLOT_H = 150;
const FULL_PLOT_H = 300;
const Y_TICKS = [0, 0.25, 0.5, 0.75, 1] as const;

/** Spacing (px) around the plot area inside the SVG. */
const PLOT_MARGINS = { top: 8, bottom: 4, left: 4, right: 4 } as const;

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
  topPad: number = 0,
): string {
  if (!steps.length) return '';
  const sx = (t: number) => plotLeft + (t / xMax) * plotW;
  const sy = (p: number) => topPad + strokePad + plotH - p * plotH;

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
  topPad: number = 0,
): string {
  if (!steps.length || steps[0].CI_Lower == null) return '';
  const sx = (t: number) => plotLeft + (t / xMax) * plotW;
  const sy = (p: number) => topPad + strokePad + plotH - p * plotH;

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
  const containerRef = useRef<HTMLDivElement>(null);
  const plotAreaRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPixelX, setHoverPixelX] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = (entry: ResizeObserverEntry) => {
      const { width, height } = entry.contentRect;
      setContainerWidth((prev) => (prev === width ? prev : width));
      setContainerHeight((prev) => (prev === height ? prev : height));
    };
    setContainerWidth(el.clientWidth);
    setContainerHeight(el.clientHeight);
    const ro = new ResizeObserver(([entry]) => update(entry));
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

  // Check if any curve has CI data (only rendered in full mode)
  const hasCI = isFull && curves.some((c) => c.steps.length > 0 && c.steps[0].CI_Lower != null);

  // Risk table height (full mode only)
  const riskTableH = isFull && activeTimepoints.length > 0
    ? RISK_ROW_H + curves.length * RISK_FIELDS.length * RISK_ROW_H
    : 0;

  const width = Math.max(COMPACT_W, Math.round(containerWidth) || COMPACT_W);
  const plotLeft = Y_AXIS_W;
  const plotW = Math.max(120, width - plotLeft - PLOT_MARGINS.right);
  const plotH = isFull ? FULL_PLOT_H : Math.max(COMPACT_PLOT_H, Math.round(containerHeight) - X_AXIS_H - PLOT_MARGINS.bottom - STROKE_PAD - PLOT_MARGINS.top);
  const svgH = PLOT_MARGINS.top + STROKE_PAD + plotH + PLOT_MARGINS.bottom;

  const ticks = niceTicks(xMax);
  // In full mode, gridlines align to risk timepoints; in compact mode, use auto ticks
  const gridTicks = isFull ? activeTimepoints : ticks;
  const toPixel = (t: number) => plotLeft + (t / xMax) * plotW;
  const toYPixel = (p: number) => PLOT_MARGINS.top + STROKE_PAD + plotH - p * plotH;
  const toTime = (px: number) => Math.max(0, Math.min(xMax, ((px - plotLeft) / plotW) * xMax));

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = plotAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    setHoverPixelX(px);
    setHoverTime(toTime(px));
  }, [xMax]);

  const handleMouseLeave = useCallback(() => setHoverTime(null), []);

  // Build tooltip data when hovering
  const hoverData = useMemo(() => {
    if (hoverTime == null) return null;
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
    paddingLeft: PLOT_MARGINS.left,
    paddingBottom: PLOT_MARGINS.bottom,
    minHeight: svgH + X_AXIS_H + riskTableH + PLOT_MARGINS.bottom,
  };

  return (
    <div className={containerClass} style={containerStyle} ref={containerRef}>
      {/* KM step curves with CI bands */}
      <div className={styles.plotArea} ref={plotAreaRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
        <svg width={width} height={svgH} className={styles.kmSvg}>
          {Y_TICKS.map((tick) => (
            <g key={tick}>
              <line
                x1={plotLeft}
                x2={plotLeft + plotW}
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
              y1={PLOT_MARGINS.top + STROKE_PAD}
              y2={PLOT_MARGINS.top + STROKE_PAD + plotH}
              className={styles.gridLineVertical}
            />
          ))}
          <line
            x1={plotLeft}
            x2={plotLeft}
            y1={PLOT_MARGINS.top + STROKE_PAD}
            y2={PLOT_MARGINS.top + STROKE_PAD + plotH}
            className={styles.axisLine}
          />
          <line
            x1={plotLeft}
            x2={plotLeft + plotW}
            y1={PLOT_MARGINS.top + STROKE_PAD + plotH}
            y2={PLOT_MARGINS.top + STROKE_PAD + plotH}
            className={styles.axisLine}
          />
          {curves.map((c, i) => {
            const dimmed = activeIndex !== null && activeIndex !== i;
            const ciPath = hasCI ? buildCIBand(c.steps, plotW, plotH, plotLeft, STROKE_PAD, xMax, PLOT_MARGINS.top) : '';
            return (
              <g key={c.cohortName} opacity={dimmed ? 0.15 : 1}>
                {ciPath && (
                  <path d={ciPath} fill={c.color} fillOpacity={0.12} stroke="none" />
                )}
                <path
                  d={buildStepPath(c.steps, plotW, plotH, plotLeft, STROKE_PAD, xMax, PLOT_MARGINS.top)}
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

        {/* Hover crosshair + tooltip */}
        {hoverTime != null && hoverData && (
          <>
            <div className={styles.crosshairLine} style={{ left: hoverPixelX, height: svgH }} />
            <div
              className={styles.tooltip}
              style={{ left: hoverPixelX > width / 2 ? hoverPixelX - 4 : hoverPixelX + 4, transform: hoverPixelX > width / 2 ? 'translateX(-100%)' : undefined }}
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

      {/* X-axis tick labels (below the plot) */}
      <div className={styles.xAxisRow}>
        {gridTicks.map((t) => (
          <span key={t} className={styles.xAxisTick} style={{ left: toPixel(t) }}>
            {t}
          </span>
        ))}
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
