import { FC, useMemo } from 'react';
import {
  type CohortClassified,
  type CharacteristicItem,
  type KdeCurve,
  collectCharacteristics,
  groupCharacteristicsBySection,
} from './types';
import { BarChartCellRenderer } from './CellRenderers/BarChartCellRenderer';
import { useBarHoverStore } from './CellRenderers/useBarHoverStore';
import styles from './CharacteristicsChart.module.css';
import sectionStyles from './ReportViewer.module.css';

/* ── Constants ───────────────────────────────────────────────────────── */

const BAR_ROW_H = 16;
const ROW_PADDING_TOP = 20;
const ROW_PADDING_BOTTOM = 20;
const STAT_KEYS = ['N', 'Mean', 'STD', 'Median', 'Min', 'Max'] as const;

/* ── Main component ──────────────────────────────────────────────────── */

interface CharacteristicsChartProps {
  cohortData: CohortClassified[];
  sections: Record<string, string[]> | null;
  sectionRefs: Map<string, HTMLDivElement>;
}

export const CharacteristicsChart: FC<CharacteristicsChartProps> = ({
  cohortData,
  sections,
  sectionRefs,
}) => {
  const items = useMemo(() => collectCharacteristics(cohortData), [cohortData]);
  const groups = useMemo(
    () => groupCharacteristicsBySection(items, sections),
    [items, sections],
  );

  // Derive KDE data from cohortData (already loaded with table1)
  const kdeData = useMemo(() => {
    const result: Record<string, Record<string, KdeCurve>> = {};
    for (const cd of cohortData) {
      if (cd.data.kdes) result[cd.name] = cd.data.kdes;
    }
    return result;
  }, [cohortData]);

  if (!items.length) return null;

  return (
    <div className={styles.container}>
      {groups.map((g, gi) => {
        const key = g.section ?? `_ungrouped_${gi}`;
        return (
          <div
            key={key}
            ref={(el) => {
              if (el) sectionRefs.set(key, el);
              else sectionRefs.delete(key);
            }}
          >
            {g.section && (
              <h3 className={sectionStyles.sectionHeader}>{g.section}</h3>
            )}
            {g.items.map((item) => (
              <CharacteristicRow
                key={item.baseName}
                item={item}
                cohortData={cohortData}
                kdeData={kdeData}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};

/* ── Row dispatcher ──────────────────────────────────────────────────── */

const CharacteristicRow: FC<{
  item: CharacteristicItem;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
}> = ({ item, cohortData, kdeData }) => {
  if (item.type === 'categorical') {
    return <CategoricalRow baseName={item.baseName} cohortData={cohortData} />;
  }
  if (item.type === 'numeric') {
    return <NumericRow name={item.baseName} cohortData={cohortData} kdeData={kdeData} />;
  }
  return <BooleanRow name={item.baseName} cohortData={cohortData} />;
};

/* ── Boolean row ─────────────────────────────────────────────────────── */

const BooleanRow: FC<{ name: string; cohortData: CohortClassified[] }> = ({
  name,
  cohortData,
}) => {
  const rowHeight =
    cohortData.length * BAR_ROW_H + ROW_PADDING_TOP + ROW_PADDING_BOTTOM;
  return (
    <div className={styles.row} style={{ height: rowHeight }}>
      <div className={styles.nameCell}>{name}</div>
      <div className={styles.chartCell}>
        <BarChartCellRenderer data={{ name, _meta: { cohortData } }} />
      </div>
    </div>
  );
};

/* ── Categorical row (each category as a sub-row) ────────────────────── */

const CategoricalRow: FC<{
  baseName: string;
  cohortData: CohortClassified[];
}> = ({ baseName, cohortData }) => {
  const categories = useMemo(() => {
    const cats: string[] = [];
    const catSet = new Set<string>();
    for (const cd of cohortData) {
      const items = cd.classified.categoricals[baseName];
      if (items) {
        for (const item of items) {
          if (!catSet.has(item.category)) {
            catSet.add(item.category);
            cats.push(item.category);
          }
        }
      }
    }
    return cats;
  }, [baseName, cohortData]);

  const subRowHeight =
    cohortData.length * BAR_ROW_H + ROW_PADDING_TOP + ROW_PADDING_BOTTOM;

  return (
    <div className={styles.categoricalGroup}>
      <div className={styles.categoricalHeader}>{baseName}</div>
      {categories.map((cat) => {
        const fullName = `${baseName}=${cat}`;
        return (
          <div key={cat} className={styles.row} style={{ height: subRowHeight }}>
            <div className={`${styles.nameCell} ${styles.subNameCell}`}>
              {cat}
            </div>
            <div className={styles.chartCell}>
              <BarChartCellRenderer
                data={{ name: fullName, _meta: { cohortData } }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ── Numeric row ─────────────────────────────────────────────────────── */

const fmt = (v: number | null | undefined) => {
  if (v == null || isNaN(v)) return '–';
  return v % 1 !== 0 ? v.toFixed(1) : String(v);
};

const KDE_PAD = 4; // horizontal padding so strokes aren't clipped
const KDE_W = 300;
const KDE_PLOT_W = KDE_W - KDE_PAD * 2; // actual plot area
const KDE_H = 60;
const KDE_AXIS_H = 16;
const KDE_TOTAL_H = KDE_H + KDE_AXIS_H;
const N_TICKS = 5;

function buildKdePath(curve: KdeCurve, plotW: number, h: number, pad: number, xMin: number, xMax: number): string {
  const { x, y } = curve;
  if (!x.length) return '';
  const xRange = xMax - xMin || 1;
  const sx = (v: number) => pad + ((v - xMin) / xRange) * plotW;
  const sy = (v: number) => h - (v / 100) * h;
  let d = `M${sx(x[0])},${sy(y[0])}`;
  for (let i = 1; i < x.length; i++) {
    d += `L${sx(x[i])},${sy(y[i])}`;
  }
  return d;
}

function fmtTick(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toFixed(0);
  if (abs >= 10) return v.toFixed(0);
  if (abs >= 1) return v.toFixed(1);
  return v.toPrecision(2);
}

const NumericRow: FC<{
  name: string;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
}> = ({ name, cohortData, kdeData }) => {
  const { activeIndex, onClick } = useBarHoverStore();
  const curves = cohortData
    .map((cd) => {
      const curve = kdeData[cd.name]?.[name];
      if (!curve) return null;
      return { color: cd.color, curve, cohortName: cd.name };
    })
    .filter(Boolean) as { color: string; curve: KdeCurve; cohortName: string }[];

  // Compute global x range across all curves
  let gMin = Infinity, gMax = -Infinity;
  for (const c of curves) {
    const xs = c.curve.x;
    if (xs.length) {
      if (xs[0] < gMin) gMin = xs[0];
      if (xs[xs.length - 1] > gMax) gMax = xs[xs.length - 1];
    }
  }
  if (!isFinite(gMin)) { gMin = 0; gMax = 1; }

  return (
    <div className={styles.numericRow}>
      <div className={styles.nameCell}>{name}</div>
      <div className={styles.kdeCell}>
        {curves.length > 0 ? (
          <svg width={KDE_W} height={KDE_TOTAL_H} className={styles.kdeSvg}>
            {curves.map((c) => {
              const idx = cohortData.findIndex((cd) => cd.name === c.cohortName);
              const dimmed = activeIndex !== null && activeIndex !== idx;
              return (
                <path
                  key={c.cohortName}
                  d={buildKdePath(c.curve, KDE_PLOT_W, KDE_H, KDE_PAD, gMin, gMax)}
                  fill="none"
                  stroke={c.color}
                  strokeWidth={1.5}
                  opacity={dimmed ? 0.15 : 0.85}
                />
              );
            })}
            {/* x-axis ticks */}
            {Array.from({ length: N_TICKS + 1 }, (_, i) => {
              const frac = i / N_TICKS;
              const val = gMin + frac * (gMax - gMin);
              const px = KDE_PAD + frac * KDE_PLOT_W;
              return (
                <g key={i}>
                  <line x1={px} y1={KDE_H} x2={px} y2={KDE_H + 4} stroke="#999" strokeWidth={0.5} />
                  <text x={px} y={KDE_H + 14} textAnchor="middle" fontSize={9} fill="#999">
                    {fmtTick(val)}
                  </text>
                </g>
              );
            })}
          </svg>
        ) : (
          <div className={styles.kdeEmpty}>no distribution</div>
        )}
      </div>
      <div className={styles.statsGrid}>
        <div className={styles.statsHeaderRow}>
          <div className={styles.statsCohortCell} />
          {STAT_KEYS.map((k) => (
            <div key={k} className={styles.statsHeaderCell}>{k}</div>
          ))}
        </div>
        {cohortData.map((cd, i) => {
          const row = cd.data.rows.find((r) => r.Name === name);
          if (!row) return null;
          const dimmed = activeIndex !== null && activeIndex !== i;
          return (
            <div
              key={cd.name}
              className={styles.statsRow}
              onClick={() => onClick(i)}
              style={{ opacity: dimmed ? 0.25 : 1, cursor: 'pointer' }}
            >
              <div className={styles.statsCohortCell}>
                <span className={styles.statDot} style={{ backgroundColor: cd.color }} />
              </div>
              {STAT_KEYS.map((k) => (
                <div key={k} className={styles.statsValueCell}>
                  {fmt(row[k] as number | null | undefined)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};