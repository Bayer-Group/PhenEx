import { FC, useRef, useState, useLayoutEffect } from 'react';
import { type CohortClassified, getCohortLabelParts } from '../../types';
import { useBarHoverStore } from './useBarHoverStore';
import { NumericChartFrame } from './NumericChartFrame';
import { BoxPlotModal } from '../ModalRenderers/BoxPlotModal';
import { Portal } from '../../../../components/Portal/Portal';
import { type BarChartSpacer, buildFlatItems, SPACER_UNIT_PX } from './barChartShared';
import styles from './BoxPlotCellRenderer.module.css';

/* ── Layout constants ────────────────────────────────────────────────── */

const PAD = 2;
const DEFAULT_W = 300;
const ROW_H = 14;
const ROW_GAP = 2;
const SPACER_H = 10;
const MARGIN_TOP = 40;
const MARGIN_BOTTOM = 40;
const LABEL_ROW_H = 18; // height reserved for labels below the plot

/**
 * A whisker is considered a long tail when it extends beyond this many
 * IQR-widths past Q1 (left) or Q3 (right). Only then is the axis clipped.
 */
const CLIP_IQR_FACTOR = 1.5;

/**
 * Fraction of the full IQR added as padding beyond the most extreme Q1/Q3
 * so that Q1/Q3 are never rendered right at the axis edge.
 */
const Q_EDGE_PAD_FACTOR = 0.5;

/* ── Helpers ─────────────────────────────────────────────────────────── */

/**
 * Core clip-bound computation shared between the component and the exported
 * helper. Given a list of {p25, p75, min, max} stats:
 *
 * - The axis is clipped on a side only when at least one cohort has a long
 *   tail (whisker extends past CLIP_IQR_FACTOR × IQR beyond Q1/Q3).
 * - When clipping, the axis bound is the loosest (most permissive) IQR fence
 *   across all cohorts, so cohorts with wider spreads keep their whiskers.
 * - The axis is then further expanded to guarantee all Q1/Q3 values have at
 *   least Q_EDGE_PAD_FACTOR × IQR of space on either side — Q boxes never
 *   appear jammed against the axis edge.
 */
function computeClipBounds(
  allStats: { p25: number; p75: number; min: number; max: number }[],
  rawXMin: number,
  rawXMax: number,
): { outMin: number; outMax: number } {
  let anyClipLo = false;
  let anyClipHi = false;
  // Loosest (most permissive) IQR fence that triggers clipping.
  let fenceLo = Infinity;
  let fenceHi = -Infinity;

  for (const s of allStats) {
    const iqr = s.p75 - s.p25;
    const lo = s.p25 - CLIP_IQR_FACTOR * iqr;
    const hi = s.p75 + CLIP_IQR_FACTOR * iqr;
    if (s.min < lo) {
      anyClipLo = true;
      if (lo < fenceLo) fenceLo = lo; // keep loosest = smallest lower fence
    }
    if (s.max > hi) {
      anyClipHi = true;
      if (hi > fenceHi) fenceHi = hi; // keep loosest = largest upper fence
    }
  }

  if (!anyClipLo && !anyClipHi) return { outMin: rawXMin, outMax: rawXMax };

  // Ensure Q1/Q3 of every cohort has padding room so they're not at the edge.
  let minQ1 = Infinity;
  let maxQ3 = -Infinity;
  let maxIQR = 0;
  for (const s of allStats) {
    if (s.p25 < minQ1) minQ1 = s.p25;
    if (s.p75 > maxQ3) maxQ3 = s.p75;
    const iqr = s.p75 - s.p25;
    if (iqr > maxIQR) maxIQR = iqr;
  }
  const pad = Q_EDGE_PAD_FACTOR * maxIQR;

  const outMin = anyClipLo
    ? Math.max(rawXMin, Math.min(fenceLo, minQ1 - pad))
    : rawXMin;
  const outMax = anyClipHi
    ? Math.min(rawXMax, Math.max(fenceHi, maxQ3 + pad))
    : rawXMax;

  return { outMin, outMax };
}

/**
 * Given a set of cohorts and a row name, compute the clipped x-axis bounds
 * using the same IQR-fence logic as BoxPlotCellRenderer's clipMax mode.
 * Returns { xMin, xMax } suitable for passing to NumericChartFrame.
 */
export interface ClippedXBounds {
  xMin: number;
  xMax: number;
  /** If the left edge was clipped, the true raw minimum value. */
  clippedLeft?: { value: number };
  /** If the right edge was clipped, the true raw maximum value. */
  clippedRight?: { value: number };
}

export function computeClippedXBounds(
  name: string,
  cohortData: CohortClassified[],
  rawXMin: number,
  rawXMax: number,
): ClippedXBounds {
  const allStats: { p25: number; p75: number; min: number; max: number }[] = [];
  for (const cd of cohortData) {
    const row = cd.data.rows.find((r) => r.Name === name);
    if (!row) continue;
    const p25 = row.P25 as number | null | undefined;
    const p75 = row.P75 as number | null | undefined;
    const min = row.Min as number | null | undefined;
    const max = row.Max as number | null | undefined;
    if (p25 == null || p75 == null) continue;
    allStats.push({ p25, p75, min: min ?? p25, max: max ?? p75 });
  }
  if (allStats.length === 0) return { xMin: rawXMin, xMax: rawXMax };

  const { outMin, outMax } = computeClipBounds(allStats, rawXMin, rawXMax);
  const eps = (rawXMax - rawXMin) * 1e-6;
  return {
    xMin: outMin,
    xMax: outMax,
    clippedLeft: outMin > rawXMin + eps ? { value: rawXMin } : undefined,
    clippedRight: outMax < rawXMax - eps ? { value: rawXMax } : undefined,
  };
}

function fmt(v: number): string {
  if (Number.isInteger(v)) return v.toString();
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toFixed(1);
  if (abs >= 100) return v.toFixed(2);
  if (abs >= 10) return v.toFixed(2);
  if (abs >= 1) return v.toFixed(3);
  return v.toPrecision(3);
}

interface CohortLabel {
  parent: string;
  sub: string | null;
  color: string;
}

function getCohortLabel(cohortData: CohortClassified[], index: number): CohortLabel {
  const cohort = cohortData[index];
  if (!cohort) return { parent: '', sub: null, color: '' };
  const getDisplayName = (n: string) => cohortData.find((c) => c.name === n)?.displayName;
  const { parent, sub } = getCohortLabelParts(cohort.name, getDisplayName);
  const parentIdx = cohort.name.indexOf('__');
  const parentCohort = parentIdx !== -1 ? cohortData.find((c) => c.name === cohort.name.substring(0, parentIdx)) : null;
  return { parent, sub, color: parentCohort?.color ?? cohort.color };
}

interface BoxStats {
  min: number;
  p10: number;
  p25: number;
  median: number;
  mean: number | null;
  p75: number;
  p90: number;
  max: number;
}

function getStats(row: Record<string, unknown>): BoxStats | null {
  const min = row.Min as number | null | undefined;
  const p10 = row.P10 as number | null | undefined;
  const p25 = row.P25 as number | null | undefined;
  const median = row.Median as number | null | undefined;
  const mean = row.Mean as number | null | undefined;
  const p75 = row.P75 as number | null | undefined;
  const p90 = row.P90 as number | null | undefined;
  const max = row.Max as number | null | undefined;

  if (p25 == null || p75 == null || median == null) return null;
  return {
    min: min ?? p25,
    p10: p10 ?? p25,
    p25,
    median,
    mean: mean ?? null,
    p75,
    p90: p90 ?? p75,
    max: max ?? p75,
  };
}

function getLandmarks(stats: BoxStats): { val: number; label: string }[] {
  return [
    { val: stats.min, label: 'Min' },
    { val: stats.p25, label: 'P25' },
    ...(stats.mean != null ? [{ val: stats.mean, label: 'Mean' }] : []),
    { val: stats.median, label: 'Med' },
    { val: stats.p75, label: 'P75' },
    { val: stats.max, label: 'Max' },
  ];
}

/** Nudge label positions so they don't overlap, returning displaced x positions. */
const LABEL_MIN_GAP = 36;

function deOverlap(
  landmarks: { val: number; label: string }[],
  toX: (val: number) => number,
): { val: number; label: string; labelX: number; originX: number }[] {
  const items = landmarks.map((m) => ({
    ...m,
    originX: toX(m.val),
    labelX: toX(m.val),
  }));
  items.sort((a, b) => a.labelX - b.labelX);

  // Push apart left→right
  for (let i = 1; i < items.length; i++) {
    if (items[i].labelX - items[i - 1].labelX < LABEL_MIN_GAP) {
      items[i].labelX = items[i - 1].labelX + LABEL_MIN_GAP;
    }
  }
  // Push back right→left
  for (let i = items.length - 2; i >= 0; i--) {
    if (items[i + 1].labelX - items[i].labelX < LABEL_MIN_GAP) {
      items[i].labelX = items[i + 1].labelX - LABEL_MIN_GAP;
    }
  }
  return items;
}

/* ── Component ───────────────────────────────────────────────────────── */

interface BoxPlotCellRendererProps {
  name: string;
  cohortData: CohortClassified[];
  xMin: number;
  xMax: number;
  width?: number;
  showGrid?: boolean;
  showTicks?: boolean;
  spacers?: BarChartSpacer[];
  spacerUnitPx?: number;
  /** If set, only show the box plot for this cohort index. */
  cohortIndex?: number;
  /** Always show landmark labels (for modal use). */
  showLabels?: boolean;
  /**
   * When true (default), the x-axis is clipped to IQR ± CLIP_IQR_FACTOR*IQR
   * when any whisker is significantly beyond Q1/Q3. A hatch pattern marks the
   * truncated region at each clipped edge.
   */
  clipMax?: boolean;
}

export const BoxPlotCellRenderer: FC<BoxPlotCellRendererProps> = ({
  name,
  cohortData,
  xMin,
  xMax,
  width: widthProp,
  showGrid = true,
  showTicks = true,
  spacers,
  spacerUnitPx = SPACER_UNIT_PX,
  cohortIndex,
  showLabels = false,
  clipMax = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = widthProp ?? (containerW || DEFAULT_W);
  const PLOT_W = W - PAD * 2;
  const { activeIndex, onClick } = useBarHoverStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [landmarkTooltip, setLandmarkTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    value: string;
    cohortLabel: CohortLabel;
    color: string;
  } | null>(null);

  // ── Clip-max: derive tighter axis bounds when outlier whiskers are extreme ──
  const { effXMin, effXMax, clippedLeft, clippedRight } = (() => {
    if (!clipMax) return { effXMin: xMin, effXMax: xMax, clippedLeft: undefined as { value: number } | undefined, clippedRight: undefined as { value: number } | undefined };

    // Gather all stats across visible cohorts for this row
    const allStats: BoxStats[] = [];
    for (const cd of cohortData) {
      const row = cd.data.rows.find((r) => r.Name === name);
      if (!row) continue;
      const s = getStats(row as unknown as Record<string, unknown>);
      if (s) allStats.push(s);
    }
    if (allStats.length === 0) return { effXMin: xMin, effXMax: xMax, clippedLeft: undefined as { value: number } | undefined, clippedRight: undefined as { value: number } | undefined };

    const { outMin, outMax } = computeClipBounds(allStats, xMin, xMax);
    const eps = (xMax - xMin) * 1e-6;
    return {
      effXMin: outMin,
      effXMax: outMax,
      clippedLeft: outMin > xMin + eps ? { value: xMin } : undefined,
      clippedRight: outMax < xMax - eps ? { value: xMax } : undefined,
    };
  })();

  const xRange = effXMax - effXMin || 1;
  const toX = (v: number) => PAD + ((Math.max(effXMin, Math.min(effXMax, v)) - effXMin) / xRange) * PLOT_W;

  // Build flat items (cohort rows + spacers) respecting display order
  const flatItems = buildFlatItems(cohortData, spacers);

  // Map flat items to entries with y-offsets
  type PlotEntry =
    | { type: 'row'; color: string; stats: BoxStats; index: number; cy: number }
    | { type: 'spacer'; height: number; y: number; label?: string };

  let cursorY = 0;
  const plotItems: PlotEntry[] = [];

  for (const item of flatItems) {
    if (item.type === 'spacer') {
      // Omit spacers when showing a single cohort
      if (cohortIndex == null) {
        const h = SPACER_H + (item.size - 1) * spacerUnitPx;
        plotItems.push({ type: 'spacer', height: h, y: cursorY, label: item.label });
        cursorY += h;
      }
    } else {
      const { cohort, originalIndex } = item.row;
      if (cohortIndex != null && originalIndex !== cohortIndex) continue;
      const row = cohort.data.rows.find((r) => r.Name === name);
      const stats = row ? getStats(row as unknown as Record<string, unknown>) : null;
      if (stats) {
        const cy = cursorY + ROW_H / 2;
        plotItems.push({ type: 'row', color: cohort.color, stats, index: originalIndex, cy });
      }
      cursorY += ROW_H + ROW_GAP;
    }
  }

  const rowEntries = plotItems.filter((p): p is Extract<PlotEntry, { type: 'row' }> => p.type === 'row');
  if (rowEntries.length === 0) return null;

  // Remove trailing gap from last row
  const plotH = cursorY - ROW_GAP;
  const svgH = plotH + (showLabels ? LABEL_ROW_H : 0);
  const boxH = ROW_H * 0.6;

  const showLandmark = (ev: React.MouseEvent, rowIndex: number, landmarkLabel: string, landmarkVal: number) => {
    const entry = rowEntries[rowIndex];
    if (!entry) return;
    setLandmarkTooltip({
      x: ev.clientX + 50,
      y: ev.clientY,
      label: landmarkLabel,
      value: fmt(landmarkVal),
      cohortLabel: getCohortLabel(cohortData, entry.index),
      color: entry.color,
    });
  };

  const hideLandmark = () => setLandmarkTooltip(null);

  const content = (
    <div
      ref={containerRef}
      className={styles.container}
      style={{ paddingTop: MARGIN_TOP, paddingBottom: MARGIN_BOTTOM }}
    >
      {containerW > 0 && rowEntries.length > 0 && (
      <>
      <svg
        ref={svgRef}
        width="100%"
        height={svgH}
        viewBox={`0 0 ${W} ${svgH}`}
        preserveAspectRatio="none"
        className={styles.plotSvg}
      >
        {rowEntries.map((e, i) => {
          const { cy } = e;
          const boxTop = cy - boxH / 2;
          const { stats } = e;
          const dimmed = activeIndex !== null && activeIndex !== e.index;

          // Whisker endpoints clamped by toX to the effective axis bounds
          const minX = toX(stats.min);
          const maxX = toX(stats.max);

          // Arrow tip sits right at the axis edge
          const arrowXLeft  = PAD;
          const arrowXRight = PAD + PLOT_W;

          // Arrow geometry: chevron pointing outward (< on left, > on right)
          const ah = boxH * 0.6; // half-height of the arrowhead
          const aw = 4;          // depth of the arrow along x

          const leftClipped  = !!clippedLeft  && stats.min < effXMin;
          const rightClipped = !!clippedRight && stats.max > effXMax;

          // < arrow: tip at x, opens to the right
          const leftArrowPath  = (x: number) => `M ${x + aw} ${cy - ah} L ${x} ${cy} L ${x + aw} ${cy + ah}`;
          // > arrow: tip at x, opens to the left
          const rightArrowPath = (x: number) => `M ${x - aw} ${cy - ah} L ${x} ${cy} L ${x - aw} ${cy + ah}`;

          return (
            <g key={e.index} opacity={dimmed ? 0.15 : 0.85} style={{ transition: 'transform 0.15s ease, opacity 0.15s ease', transformOrigin: `0 ${cy}px` }}>
              {/* Whisker line — terminates at the arrow tip when clipped */}
              <line
                x1={leftClipped  ? arrowXLeft  : minX}
                y1={cy}
                x2={rightClipped ? arrowXRight : maxX}
                y2={cy}
                stroke={e.color} strokeWidth={1.5}
              />

              {/* Min end-cap or < arrow + value label outside the left edge */}
              {leftClipped ? (<>
                <path d={leftArrowPath(arrowXLeft)} stroke={e.color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <text
                  x={arrowXLeft - 4}
                  y={cy}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={8}
                  fill={e.color}
                  fontFamily="IBMPlexSans-regular, sans-serif"
                >{fmt(stats.min)}</text>
              </>) : (
                <line x1={minX} y1={cy - boxH * 0.3} x2={minX} y2={cy + boxH * 0.3} stroke={e.color} strokeWidth={1.5} />
              )}

              {/* Max end-cap or > arrow + value label outside the right edge */}
              {rightClipped ? (<>
                <path d={rightArrowPath(arrowXRight)} stroke={e.color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <text
                  x={arrowXRight + 4}
                  y={cy}
                  textAnchor="start"
                  dominantBaseline="middle"
                  fontSize={8}
                  fill={e.color}
                  fontFamily="IBMPlexSans-regular, sans-serif"
                >{fmt(stats.max)}</text>
              </>) : (
                <line x1={maxX} y1={cy - boxH * 0.3} x2={maxX} y2={cy + boxH * 0.3} stroke={e.color} strokeWidth={1.5} />
              )}

              <rect
                x={toX(stats.p25)} y={boxTop}
                width={toX(stats.p75) - toX(stats.p25)} height={boxH}
                fill={e.color} fillOpacity={.5}
                stroke={e.color} strokeWidth={1.5} rx={1}
              />
              <line x1={toX(stats.median)} y1={boxTop - 1} x2={toX(stats.median)} y2={boxTop + boxH + 1} stroke={e.color} strokeWidth={3} />
              {stats.mean != null && <circle cx={toX(stats.mean)} cy={cy} r={(boxH - 2) / 2} fill={e.color} strokeWidth={1.5} stroke="black" />}

              {/* Invisible landmark hit targets */}
              {(
                [
                  { lbl: 'Min', val: stats.min },
                  { lbl: 'Q1', val: stats.p25 },
                  { lbl: 'Median', val: stats.median },
                  ...(stats.mean != null ? [{ lbl: 'Mean', val: stats.mean }] : []),
                  { lbl: 'Q3', val: stats.p75 },
                  { lbl: 'Max', val: stats.max },
                ] as { lbl: string; val: number }[]
              ).map(({ lbl, val }) => (
                <circle
                  key={lbl}
                  cx={toX(val)}
                  cy={cy}
                  r={6}
                  fill="transparent"
                  stroke="none"
                  style={{ cursor: 'default' }}
                  onMouseEnter={(ev) => showLandmark(ev, i, lbl, val)}
                  onMouseLeave={hideLandmark}
                />
              ))}
            </g>
          );
        })}
      </svg>

      {/* Spacer labels as HTML overlay — SVG preserveAspectRatio=none would distort text */}
      <div className={styles.spacerLabelOverlay} style={{ height: svgH }}>
        {plotItems.map((p, pi) => {
          if (p.type !== 'spacer' || !p.label) return null;
          const topPct = ((p.y + p.height) / svgH) * 100;
          return (
            <span key={pi} className={styles.spacerLabel} style={{ top: `${topPct}%` }}>
              {p.label}
            </span>
          );
        })}
      </div>
      </>
      )}

      {landmarkTooltip && (
        <Portal>
          <div
            className={styles.tooltipWrapper}
            style={{ left: landmarkTooltip.x, top: landmarkTooltip.y, transform: 'translate(-50%, -115%)' }}
          >
            <div className={styles.tooltipCohort} style={{ color: landmarkTooltip.color }}>
              <div className={styles.tooltipParent}>{landmarkTooltip.cohortLabel.parent}</div>
              {landmarkTooltip.cohortLabel.sub && (
                <div className={styles.tooltipSub}>{landmarkTooltip.cohortLabel.sub}</div>
              )}
            </div>
            <div className={styles.tooltipStats}>
              <div className={styles.tooltipStat}>
                <span className={styles.tooltipLabel}>{landmarkTooltip.label}</span>
                <span className={styles.tooltipValue}>{landmarkTooltip.value}</span>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );

  if (showGrid) {
    return (
      <NumericChartFrame xMin={effXMin} xMax={effXMax} width={W} showTicks={showTicks} clippedLeft={clippedLeft} clippedRight={clippedRight}>
        {content}
      </NumericChartFrame>
    );
  }

  return content;
};
