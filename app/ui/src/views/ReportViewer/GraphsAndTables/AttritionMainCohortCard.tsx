import { FC, useMemo, useState } from 'react';
import { AttritionCellRenderer } from './RowRenderers/AttritionCellRenderer';
import styles from './AttritionMainCohortCard.module.css';

interface ChartEntry {
  cohortName: string;
  label: string;
  color: string;
  rows: any[];
  databaseSize: number | null;
}

interface AttritionMainCohortCardProps {
  parent: string;
  groupColor: string;
  charts: ChartEntry[];
  parentRowNames: Set<string>;
  sharedRowMode: 'show' | 'hide' | 'dim';
  hoveredParentRow: string | null;
  onParentRowHover: (name: string | null) => void;
}

function getFinalCount(rows: any[]): number | null {
  if (!rows.length) return null;
  return rows[rows.length - 1]?.count ?? null;
}

function getEntryCount(rows: any[]): number | null {
  if (!rows.length) return null;
  return rows[0]?.count ?? null;
}

function fmtN(n: number | null): string {
  if (n == null) return '?';
  return n.toLocaleString();
}

function fmtPct(n: number | null, total: number | null): string {
  if (n == null || total == null || total === 0) return '';
  const pct = (n / total) * 100;
  if (pct >= 99.95) return '100%';
  if (pct > 0 && pct < 0.05) return '<0.1%';
  return `${pct.toFixed(1)}%`;
}

export const AttritionMainCohortCard: FC<AttritionMainCohortCardProps> = ({
  parent, groupColor, charts, parentRowNames, sharedRowMode, hoveredParentRow, onParentRowHover,
}) => {
  const [selectedCohort, setSelectedCohort] = useState(parent);

  // Find the chart to display
  const activeChart = useMemo(
    () => charts.find((c) => c.cohortName === selectedCohort) ?? charts[0],
    [charts, selectedCohort],
  );

  // Entry count from the main cohort for % calculation
  const mainEntryCount = useMemo(() => {
    const main = charts.find((c) => c.cohortName === parent);
    return main ? getEntryCount(main.rows) : null;
  }, [charts, parent]);

  if (!activeChart) return null;

  const isMainSelected = activeChart.cohortName === parent;

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle} style={{ color: groupColor }}>
        {parent}
      </div>

      <AttritionCellRenderer
        rows={activeChart.rows}
        cohortId={activeChart.cohortName}
        databaseSize={activeChart.databaseSize}
        parentRowNames={
          !isMainSelected && charts.length > 1 ? parentRowNames : undefined
        }
        sharedRowMode={sharedRowMode}
        hoveredParentRow={hoveredParentRow}
        onParentRowHover={onParentRowHover}
      />

      {charts.length > 1 && (
        <div className={styles.selectorGrid}>
          {charts.map((chart) => {
            const finalN = getFinalCount(chart.rows);
            const isActive = chart.cohortName === activeChart.cohortName;
            return (
              <div
                key={chart.cohortName}
                className={`${styles.selectorItem} ${isActive ? styles.selectorItemActive : ''}`}
                onClick={() => setSelectedCohort(chart.cohortName)}
              >
                <div className={styles.selectorDot} style={{ backgroundColor: chart.color }} />
                <span className={styles.selectorLabel}>
                  {chart.cohortName === parent ? 'Main Cohort' : chart.label}
                </span>
                <span className={styles.selectorN}>{fmtN(finalN)}</span>
                <span className={styles.selectorPct}>{fmtPct(finalN, mainEntryCount)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
