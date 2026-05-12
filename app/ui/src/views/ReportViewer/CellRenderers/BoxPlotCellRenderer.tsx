import { FC, useRef, useState, useLayoutEffect } from 'react';
import { type CohortClassified } from '../types';
import { useBarHoverStore } from './useBarHoverStore';
import { NumericChartFrame } from './NumericChartFrame';
import { BoxPlotModal } from './BoxPlotModal';
import styles from './BoxPlotCellRenderer.module.css';

/* ── Layout constants ────────────────────────────────────────────────── */

const PAD = 4;
const DEFAULT_W = 300;
const ROW_H = 14;
const ROW_GAP = 2;
const LABEL_ROW_H = 18; // height reserved for labels below the plot

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
  const { activeIndex } = useBarHoverStore();
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
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

  // Filter: explicit cohortIndex > activeIndex store > all
  let entries = allEntries;
  if (cohortIndex != null) {
    entries = allEntries.filter((e) => e.index === cohortIndex);
  } else if (activeIndex !== null) {
    entries = allEntries.filter((e) => e.index === activeIndex);
  }

  if (entries.length === 0) return null;

  const plotH = entries.length * (ROW_H + ROW_GAP) - ROW_GAP;
  const svgH = plotH + (showLabels ? LABEL_ROW_H : 0);
  const boxH = ROW_H * 0.6;

  const content = (
    <div ref={containerRef} className={styles.container}>
      {containerW > 0 && entries.length > 0 && (
      <svg
        ref={svgRef}
        width="100%"
        height={svgH}
        viewBox={`0 0 ${W} ${svgH}`}
        preserveAspectRatio="none"
        className={styles.plotSvg}
        onMouseMove={(e) => {
          const rect = svgRef.current?.getBoundingClientRect();
          if (!rect) return;
          const localY = e.clientY - rect.top;
          const idx = Math.floor(localY / (ROW_H + ROW_GAP));
          if (idx >= 0 && idx < entries.length) {
            setHoveredRow(idx);
            setHoverPos({ x: e.clientX, y: rect.top });
          } else {
            setHoveredRow(null);
            setHoverPos(null);
          }
        }}
        onMouseLeave={() => { setHoveredRow(null); setHoverPos(null); }}
      >
        {entries.map((e, i) => {
          const cy = i * (ROW_H + ROW_GAP) + ROW_H / 2;
          const boxTop = cy - boxH / 2;
          const { stats } = e;

          return (
            <g key={e.index} opacity={0.85}>
              <line x1={toX(stats.min)} y1={cy} x2={toX(stats.max)} y2={cy} stroke={e.color} strokeWidth={1} />
              <line x1={toX(stats.min)} y1={cy - boxH * 0.3} x2={toX(stats.min)} y2={cy + boxH * 0.3} stroke={e.color} strokeWidth={1} />
              <line x1={toX(stats.max)} y1={cy - boxH * 0.3} x2={toX(stats.max)} y2={cy + boxH * 0.3} stroke={e.color} strokeWidth={1} />
              <rect
                x={toX(stats.p25)} y={boxTop}
                width={toX(stats.p75) - toX(stats.p25)} height={boxH}
                fill={e.color} fillOpacity={0.2}
                stroke={e.color} strokeWidth={1.5} rx={1}
              />
              <line x1={toX(stats.median)} y1={boxTop} x2={toX(stats.median)} y2={boxTop + boxH} stroke={e.color} strokeWidth={2} />
              {stats.mean != null && <circle cx={toX(stats.mean)} cy={cy} r={2.5} fill={e.color} />}

              {/* Always-visible labels (modal mode) */}
              {showLabels && (() => {
                const labelY = plotH + LABEL_ROW_H - 4;
                const positioned = deOverlap(getLandmarks(stats), toX);
                return positioned.map(({ val, label, labelX, originX }) => (
                  <g key={label}>
                    <line
                      x1={originX} y1={cy + boxH * 0.3 + 1}
                      x2={labelX} y2={labelY - 9}
                      stroke={e.color} strokeWidth={0.5} strokeOpacity={0.4}
                    />
                    <text
                      x={labelX} y={labelY}
                      textAnchor="middle" fontSize={9}
                      fill={e.color}
                      fontFamily="IBMPlexSans-regular, sans-serif"
                    >
                      {label}: {fmt(val)}
                    </text>
                  </g>
                ));
              })()}
            </g>
          );
        })}
      </svg>
      )}

      {hoveredRow !== null && hoverPos && (() => {
        const e = entries[hoveredRow];
        if (!e) return null;
        return (
          <BoxPlotModal
            name={name}
            cohortData={cohortData}
            xMin={xMin}
            xMax={xMax}
            x={hoverPos.x}
            y={hoverPos.y}
            cohortIndex={e.index}
            onClose={() => { setHoveredRow(null); setHoverPos(null); }}
          />
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
