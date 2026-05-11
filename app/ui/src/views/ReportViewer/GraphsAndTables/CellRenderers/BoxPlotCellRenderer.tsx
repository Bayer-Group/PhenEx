import { FC, useRef, useState } from 'react';
import { type CohortClassified } from '../../types';
import { useBarHoverStore } from './useBarHoverStore';
import { Portal } from '../../../../components/Portal/Portal';
import styles from './BoxPlotCellRenderer.module.css';

/* ── Layout constants ────────────────────────────────────────────────── */

const PAD = 4;
const DEFAULT_W = 300;
const ROW_H = 14;
const ROW_GAP = 2;

/* ── Helpers ─────────────────────────────────────────────────────────── */

function fmt(v: number): string {
  if (Math.abs(v) < 10 && v % 1 !== 0) return v.toFixed(1);
  return Math.round(v).toString();
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
  const marks: { val: number; label: string }[] = [
    { val: stats.min, label: 'Min' },
    { val: stats.p25, label: 'P25' },
    ...(stats.mean != null ? [{ val: stats.mean, label: 'Mean' }] : []),
    { val: stats.median, label: 'Med' },
    { val: stats.p75, label: 'P75' },
    { val: stats.max, label: 'Max' },
  ];
  return marks;
}

/* ── Component ───────────────────────────────────────────────────────── */

interface BoxPlotCellRendererProps {
  name: string;
  cohortData: CohortClassified[];
  xMin: number;
  xMax: number;
  width?: number;
}

export const BoxPlotCellRenderer: FC<BoxPlotCellRendererProps> = ({
  name,
  cohortData,
  xMin,
  xMax,
  width: widthProp,
}) => {
  const W = widthProp ?? DEFAULT_W;
  const PLOT_W = W - PAD * 2;
  const { activeIndex } = useBarHoverStore();
  const [hovered, setHovered] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
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

  // Only show box plots for the active/selected cohort(s)
  const entries = activeIndex !== null
    ? allEntries.filter((e) => e.index === activeIndex)
    : allEntries;

  if (entries.length === 0) {
    return null;
  }

  const svgH = entries.length * (ROW_H + ROW_GAP) - ROW_GAP;
  const boxH = ROW_H * 0.6;

  // Compute portal tooltip positions from SVG bounding rect
  const svgRect = hovered ? svgRef.current?.getBoundingClientRect() : null;

  return (
    <div
      className={styles.container}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setHoveredRow(null); }}
    >
      <svg
        ref={svgRef}
        width={W}
        height={svgH}
        className={styles.plotSvg}
        onMouseMove={(e) => {
          const rect = svgRef.current?.getBoundingClientRect();
          if (!rect) return;
          const localY = e.clientY - rect.top;
          const rowIndex = Math.floor(localY / (ROW_H + ROW_GAP));
          setHoveredRow(rowIndex >= 0 && rowIndex < entries.length ? rowIndex : null);
        }}
        onMouseLeave={() => setHoveredRow(null)}
      >
        {entries.map((e, i) => {
          const cy = i * (ROW_H + ROW_GAP) + ROW_H / 2;
          const boxTop = cy - boxH / 2;

          const { stats } = e;

          return (
            <g key={e.index} opacity={0.85}>
              {/* Whisker line: min to max */}
              <line
                x1={toX(stats.min)}
                y1={cy}
                x2={toX(stats.max)}
                y2={cy}
                stroke={e.color}
                strokeWidth={1}
              />

              {/* Min cap */}
              <line
                x1={toX(stats.min)}
                y1={cy - boxH * 0.3}
                x2={toX(stats.min)}
                y2={cy + boxH * 0.3}
                stroke={e.color}
                strokeWidth={1}
              />

              {/* Max cap */}
              <line
                x1={toX(stats.max)}
                y1={cy - boxH * 0.3}
                x2={toX(stats.max)}
                y2={cy + boxH * 0.3}
                stroke={e.color}
                strokeWidth={1}
              />

              {/* IQR box: P25 to P75 */}
              <rect
                x={toX(stats.p25)}
                y={boxTop}
                width={toX(stats.p75) - toX(stats.p25)}
                height={boxH}
                fill={e.color}
                fillOpacity={0.2}
                stroke={e.color}
                strokeWidth={1.5}
                rx={1}
              />

              {/* Median line */}
              <line
                x1={toX(stats.median)}
                y1={boxTop}
                x2={toX(stats.median)}
                y2={boxTop + boxH}
                stroke={e.color}
                strokeWidth={2}
              />

              {/* Mean point */}
              {stats.mean != null && (
                <circle
                  cx={toX(stats.mean)}
                  cy={cy}
                  r={2.5}
                  fill={e.color}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Portal tooltips for landmarks — only for hovered row */}
      {hovered && svgRect && hoveredRow !== null && (() => {
        const e = entries[hoveredRow];
        if (!e) return null;
        const cy = hoveredRow * (ROW_H + ROW_GAP) + ROW_H / 2;
        const screenTop = svgRect.top + (cy / svgH) * svgRect.height;

        return getLandmarks(e.stats).map(({ val, label }) => {
          const px = toX(val);
          const screenX = svgRect.left + (px / W) * svgRect.width;
          return (
            <Portal key={`${e.index}-${label}`}>
              <div
                className={styles.landmarkTooltip}
                style={{ left: screenX, top: screenTop }}
              >
                <span className={styles.landmarkLabel}>{label}</span>
                <span className={styles.landmarkValue}>{fmt(val)}</span>
              </div>
            </Portal>
          );
        });
      })()}
    </div>
  );
};
