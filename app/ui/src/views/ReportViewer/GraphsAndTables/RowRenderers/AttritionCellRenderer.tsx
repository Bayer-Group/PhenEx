import React, { useMemo, forwardRef, useImperativeHandle, useCallback, useState } from 'react';
import { getAlphaForLevel } from '@/views/CohortViewer/CohortTable/CellRenderers/PhenexCellRenderer';
import styles from './AttritionCellRenderer.module.css';

interface AttritionCellRendererProps {
  rows: any[];
  cohortId: string;
  databaseSize?: number | null;
  onRowClick?: (row: any, index: number) => void;
  onExpandClick?: (row: any, index: number) => void;
  /** Names of rows shared with the parent cohort */
  parentRowNames?: Set<string>;
  /** How to display parent rows: show (normal), hide (remove), dim (reduced opacity) */
  sharedRowMode?: 'show' | 'hide' | 'dim';
  /** Currently hovered parent row name (coordinated across subcohorts) */
  hoveredParentRow?: string | null;
  /** Callback when a parent row is hovered */
  onParentRowHover?: (name: string | null) => void;
}

export interface AttritionCellRendererRef {
  exportToSVG: () => void;
  exportToPNG: () => Promise<void>;
}

interface FunnelRow {
  name: string;
  effectiveType: string;
  hierarchicalIndex: string | undefined;
  count: number | null;
  pctOfEntry: number;
  delta: number | null;
  isSynthetic: boolean;
  isParent: boolean;
  /** Last parent row: row itself shown, but delta is dimmed */
  isParentTransition: boolean;
  originalIndex: number;
}

const MIN_BAR_PCT = 5;

function fmtN(n: number | null | undefined): string {
  if (n == null) return '?';
  return n.toLocaleString();
}

function fmtPct(p: number): string {
  if (p >= 99.95) return '100%';
  if (p > 0 && p < 0.05) return '<0.1%';
  return `${p.toFixed(1)}%`;
}

/* ── Trapezoid connector between two funnel rows ────────────────────── */

const TrapezoidConnector: React.FC<{
  upperPct: number;
  lowerPct: number;
  effectiveType: string;
  hierarchicalIndex: string | undefined;
}> = ({ upperPct, lowerPct, effectiveType, hierarchicalIndex }) => {
  const alphaHex = getAlphaForLevel(hierarchicalIndex);
  const alpha = parseInt(alphaHex, 16) / 255;
  const tl = 50 - upperPct / 2;
  const tr = 50 + upperPct / 2;
  const bl = 50 - lowerPct / 2;
  const br = 50 + lowerPct / 2;

  const d = `M ${tl} 0 L ${tr} 0 L ${br} 100 L ${bl} 100 Z`;

  return (
    <div className={styles.connectorWrapper}>
      <svg
        className={styles.trapezoidSvg}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <path
          d={d}
          fill={`var(--color_${effectiveType}, transparent)`}
          opacity={alpha}
        />
      </svg>
    </div>
  );
};

/* ── Main component ─────────────────────────────────────────────────── */

export const AttritionCellRenderer = forwardRef<
  AttritionCellRendererRef,
  AttritionCellRendererProps
>(({ rows, cohortId: _cohortId, databaseSize, onRowClick, onExpandClick,
    parentRowNames, sharedRowMode = 'show', hoveredParentRow, onParentRowHover: _onParentRowHover }, ref) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    exportToSVG: () => {},
    exportToPNG: async () => {},
  }));

  /* ── Build funnel rows ──────────────────────────────────────────────── */

  const funnelRows = useMemo<FunnelRow[]>(() => {
    if (!rows?.length) return [];

    /* Width is always relative to the first real row (entry), not databaseSize.
       databaseSize is only used for the "Source Database" label count. */
    const firstCount = rows[0]?.count ?? 1;
    const widthBase = firstCount > 0 ? firstCount : 1;
    const dbCount = databaseSize ?? firstCount;

    const result: FunnelRow[] = [
      {
        name: 'Source Database',
        effectiveType: 'database',
        hierarchicalIndex: undefined,
        count: dbCount,
        pctOfEntry: 100,          // always full width
        delta: null,
        isSynthetic: true,
        isParent: false,
        isParentTransition: false,
        originalIndex: -1,
      },
    ];

    rows.forEach((r: any, i: number) => {
      const count = r.count ?? 0;
      const pct = (count / widthBase) * 100;
      const delta =
        r.excluded_count != null ? -Math.abs(r.excluded_count) : null;
      result.push({
        name: r.name || 'Unnamed',
        effectiveType: r.effective_type || 'entry',
        hierarchicalIndex: r.hierarchical_index,
        count,
        pctOfEntry: pct,
        delta,
        isSynthetic: false,
        isParent: parentRowNames?.has(r.name) ?? false,
        isParentTransition: false,
        originalIndex: i,
      });
    });

    const lastCount = rows[rows.length - 1]?.count ?? 0;
    result.push({
      name: 'Final Cohort',
      effectiveType: 'cohort',
      hierarchicalIndex: undefined,
      count: lastCount,
      pctOfEntry: (lastCount / widthBase) * 100,
      delta: null,
      isSynthetic: true,
      isParent: false,
      isParentTransition: false,
      originalIndex: -1,
    });

    return result;
  }, [rows, databaseSize, parentRowNames]);

  /** The last parent row stays visible — it's the transition into subcohort rows */
  const displayRows = useMemo(() => {
    if (!parentRowNames?.size) return funnelRows;
    let lastParentIdx = -1;
    for (let i = funnelRows.length - 1; i >= 0; i--) {
      if (funnelRows[i].isParent) { lastParentIdx = i; break; }
    }
    if (lastParentIdx === -1) return funnelRows;
    return funnelRows.map((r, i) =>
      i === lastParentIdx ? { ...r, isParent: false, isParentTransition: true } : r,
    );
  }, [funnelRows, parentRowNames]);

  /** Apply hide mode: filter out parent rows */
  const visibleRows = useMemo(() => {
    if (sharedRowMode !== 'hide') return displayRows;
    return displayRows.filter((r) => !r.isParent);
  }, [displayRows, sharedRowMode]);

  /* ── Hover state ────────────────────────────────────────────────────── */

  const [hoveredIndex, _setHoveredIndex] = useState<number | null>(null);

  const handleClick = useCallback(
    (row: FunnelRow) => {
      if (row.isSynthetic) return;
      const orig = rows[row.originalIndex];
      onRowClick?.(orig, row.originalIndex);
      onExpandClick?.(orig, row.originalIndex);
    },
    [rows, onRowClick, onExpandClick],
  );

  if (!visibleRows.length) return null;

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <div ref={containerRef} className={styles.funnelContainer}>
      {visibleRows.map((row, i) => {
        const next = visibleRows[i + 1];
        const barPct = Math.max(row.pctOfEntry, MIN_BAR_PCT);
        const isHovered = hoveredIndex === i;
        const isDimmed = sharedRowMode === 'dim' && (row.isParent || row.isParentTransition);
        const isParentHighlighted = row.isParent && hoveredParentRow === row.name;

        return (
          <div
            key={i}
            className={`${styles.funnelStep} ${isDimmed && !row.isParentTransition ? styles.dimmed : ''} ${isDimmed && row.isParentTransition ? styles.dimmedLabelsOnly : ''} ${isParentHighlighted ? styles.parentHighlighted : ''}`}
          >
            {/* Labels — full width, overlaps into trapezoid below */}
            <div
              className={`${styles.labelRow} ${!row.isSynthetic ? styles.clickable : ''} ${isHovered && !row.isSynthetic ? styles.hovered : ''}`}
              style={{
                '--row-color': row.isSynthetic
                  ? '#555'
                  : `var(--color_${row.effectiveType}, #555)`,
              } as React.CSSProperties}
              onClick={() => handleClick(row)}
            >
              <div className={styles.rowLeft}>
                <span className={styles.rowTitle}>{row.name}</span>
                {!row.isSynthetic && (
                  <span className={styles.rowSubtitle}>
                    {row.effectiveType}
                  </span>
                )}
              </div>
              <div className={styles.rowFarLeft}>
                <span className={styles.rowPct}>
                  {fmtPct(row.pctOfEntry)}
                </span>
              </div>
              <div className={styles.rowCenter}>
                <span className={styles.rowN}>
                  {fmtN(row.count)}
                </span>
              </div>
              <div className={styles.rowRight}>
                {row.delta != null &&
                  !(row.isParentTransition && sharedRowMode === 'hide') && (
                  <span className={styles.rowDelta}>
                    {fmtN(row.delta)}
                  </span>
                )}
              </div>
            </div>

            {/* Trapezoid — skip the last connector to Final Cohort */}
            {next && !next.isSynthetic && (
              <TrapezoidConnector
                upperPct={barPct}
                lowerPct={Math.max(next.pctOfEntry, MIN_BAR_PCT)}
                effectiveType={row.effectiveType}
                hierarchicalIndex={row.hierarchicalIndex}
              />
            )}
          </div>
        );
      })}
    </div>
  );
});

AttritionCellRenderer.displayName = 'AttritionCellRenderer';
