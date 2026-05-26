import { FC, useRef, useState, useLayoutEffect } from 'react';
import { type CohortClassified } from '../../types';
import { useBarHoverStore } from './useBarHoverStore';
import { NumericChartFrame } from './NumericChartFrame';
import { BoxPlotModal } from '../ModalRenderers/BoxPlotModal';
import { Portal } from '../../../../components/Portal/Portal';
import styles from './BoxPlotCellRenderer.module.css';

/* ── Layout constants ────────────────────────────────────────────────── */

const PAD = 2;
const DEFAULT_W = 300;
const ROW_H = 14;
const ROW_GAP = 2;
const LABEL_ROW_H = 18; // height reserved for labels below the plot

/* ── Helpers ─────────────────────────────────────────────────────────── */

function fmt(v: number): string {
  if (Math.abs(v) < 10 && v % 1 !== 0) return v.toFixed(1);
  return Math.round(v).toString();
}

function getCohortLabel(cohortData: CohortClassified[], index: number): string {
  const cohort = cohortData[index];
  if (!cohort) return '';
  const name = cohort.name;
  const idx = name.indexOf('__');
  if (idx === -1) return cohort.displayName || name;
  const parentName = name.substring(0, idx);
  const subLabel = name.substring(idx + 2);
  const parent = cohortData.find((c) => c.name === parentName);
  const parentDisplay = parent?.displayName || parentName;
  return `${parentDisplay} · ${subLabel}`;
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
  /** If set, only show the box plot for this cohort index. */
  cohortIndex?: number;
  /** Always show landmark labels (for modal use). */
  showLabels?: boolean;
}

export const BoxPlotCellRenderer: FC<BoxPlotCellRendererProps> = ({
  name,
  cohortData,
  xMin,
  xMax,
  width: widthProp,
  showGrid = false,
  cohortIndex,
  showLabels = false,
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
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const xRange = xMax - xMin || 1;
  const toX = (v: number) => PAD + ((v - xMin) / xRange) * PLOT_W;

  const allEntries = cohortData
    .map((cd, i) => {
      const row = cd.data.rows.find((r) => r.Name === name);
      if (!row) return null;
      const stats = getStats(row as unknown as Record<string, unknown>);
      if (!stats) return null;
      return { color: cd.color, stats, index: i };
    })
    .filter(Boolean) as { color: string; stats: BoxStats; index: number }[];

  // Filter: only for explicit cohortIndex (modal use)
  let entries = allEntries;
  if (cohortIndex != null) {
    entries = allEntries.filter((e) => e.index === cohortIndex);
  }

  if (entries.length === 0) return null;

  const plotH = entries.length * (ROW_H + ROW_GAP) - ROW_GAP;
  const svgH = plotH + (showLabels ? LABEL_ROW_H : 0);
  const boxH = ROW_H * 0.6;

  const content = (
    <div
      ref={containerRef}
      className={styles.container}
      onMouseMove={(e) => {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        if (!rect.height) return;
        const scaleY = rect.height / svgH;
        const scaleX = rect.width / W;
        const localY = (e.clientY - rect.top) / scaleY;
        const idx = Math.floor(localY / (ROW_H + ROW_GAP));
        if (idx >= 0 && idx < entries.length) {
          setHoveredRow(idx);
          const entry = entries[idx];
          const { stats } = entry;
          const meanX = stats.mean != null ? toX(stats.mean) : toX(stats.median);
          const medianX = toX(stats.median);
          const cx = rect.left + ((meanX + medianX) / 2) * scaleX;
          const cy = idx * (ROW_H + ROW_GAP) + ROW_H / 2;
          setTooltipPos({ x: cx, y: rect.top + cy * scaleY });
        } else {
          setHoveredRow(null);
          setTooltipPos(null);
        }
      }}
      onMouseLeave={() => { setHoveredRow(null); setTooltipPos(null); }}
      onClick={(e) => {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        if (!rect.height) return;
        const scaleY = rect.height / svgH;
        const localY = (e.clientY - rect.top) / scaleY;
        const idx = Math.floor(localY / (ROW_H + ROW_GAP));
        if (idx >= 0 && idx < entries.length) {
          onClick(entries[idx].index);
        }
      }}
    >
      {containerW > 0 && entries.length > 0 && (
      <svg
        ref={svgRef}
        width="100%"
        height={svgH}
        viewBox={`0 0 ${W} ${svgH}`}
        preserveAspectRatio="none"
        className={styles.plotSvg}
      >
        {entries.map((e, i) => {
          const cy = i * (ROW_H + ROW_GAP) + ROW_H / 2;
          const boxTop = cy - boxH / 2;
          const { stats } = e;
          const dimmed = activeIndex !== null && activeIndex !== e.index;

          return (
            <g key={e.index} opacity={dimmed ? 0.15 : 0.85}>
              <line x1={toX(stats.min)} y1={cy} x2={toX(stats.max)} y2={cy} stroke={e.color} strokeWidth={1} />
              <line x1={toX(stats.min)} y1={cy - boxH * 0.3} x2={toX(stats.min)} y2={cy + boxH * 0.3} stroke={e.color} strokeWidth={1} />
              <line x1={toX(stats.max)} y1={cy - boxH * 0.3} x2={toX(stats.max)} y2={cy + boxH * 0.3} stroke={e.color} strokeWidth={1} />
              <rect
                x={toX(stats.p25)} y={boxTop}
                width={toX(stats.p75) - toX(stats.p25)} height={boxH}
                fill={e.color} fillOpacity={dimmed ? 0.05 : 0.2}
                stroke={e.color} strokeWidth={1.5} rx={1}
              />
              <line x1={toX(stats.median)} y1={boxTop} x2={toX(stats.median)} y2={boxTop + boxH} stroke={e.color} strokeWidth={2} />
              {stats.mean != null && <circle cx={toX(stats.mean)} cy={cy} r={2.5} fill={e.color} />}
            </g>
          );
        })}
      </svg>
      )}

      {hoveredRow !== null && tooltipPos && (() => {
        const e = entries[hoveredRow];
        if (!e) return null;
        const { stats } = e;
        const label = getCohortLabel(cohortData, e.index);
        return (
          <Portal>
            <div className={styles.tooltipWrapper} style={{ left: tooltipPos.x, top: tooltipPos.y, transform: 'translate(-50%, -105%)' }}>
              <div className={styles.tooltipCohort} style={{ color: e.color }}>{label}</div>
              <div className={styles.tooltipStats}>
                <div className={styles.tooltipStat}><span className={styles.tooltipLabel}>Min</span><span className={styles.tooltipValue}>{fmt(stats.min)}</span></div>
                <div className={styles.tooltipStat}><span className={styles.tooltipLabel}>Mean</span><span className={styles.tooltipValue}>{stats.mean != null ? fmt(stats.mean) : '–'}</span></div>
                <div className={styles.tooltipStat}><span className={styles.tooltipLabel}>Median</span><span className={styles.tooltipValue}>{fmt(stats.median)}</span></div>
                <div className={styles.tooltipStat}><span className={styles.tooltipLabel}>Max</span><span className={styles.tooltipValue}>{fmt(stats.max)}</span></div>
              </div>
            </div>
          </Portal>
        );
      })()}
    </div>
  );

  if (showGrid) {
    return (
      <NumericChartFrame xMin={xMin} xMax={xMax} width={W} showTicks={false}>
        {content}
      </NumericChartFrame>
    );
  }

  return content;
};
