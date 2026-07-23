import { FC, useMemo, useCallback, useRef, useState } from 'react';
import { AttritionCellRenderer } from './RowRenderers/AttritionCellRenderer';
import { type CohortDescriptions } from '../types';
import { Portal } from '../../../components/Portal/Portal';
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
  cohortDescriptions?: CohortDescriptions;
  sharedRowMode: 'show' | 'hide' | 'dim';
  hoveredParentRow: string | null;
  onParentRowHover: (name: string | null) => void;
}

function getFinalCount(rows: any[]): number | null {
  if (!rows.length) return null;
  return rows[rows.length - 1]?.count ?? null;
}

function fmtN(n: number | null): string {
  if (n == null) return '?';
  return n.toLocaleString();
}

export const AttritionMainCohortCard: FC<AttritionMainCohortCardProps> = ({
  parent, groupColor, charts, parentRowNames, cohortDescriptions, sharedRowMode, hoveredParentRow, onParentRowHover,
}) => {
  const [selectedCohort, setSelectedCohort] = useState(parent);
  const [menuOpen, setMenuOpen] = useState(false);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(() => {
      if (!menuRef.current?.matches(':hover')) setMenuOpen(false);
    }, 120);
  }, []);

  const cancelClose = useCallback(() => {
    clearTimeout(closeTimer.current);
  }, []);

  // Find the chart to display
  const activeChart = useMemo(
    () => charts.find((c) => c.cohortName === selectedCohort) ?? charts[0],
    [charts, selectedCohort],
  );

  if (!activeChart) return null;

  const isMainSelected = activeChart.cohortName === parent;
  const hasMultiple = charts.length > 1;
  const subtitleLabel = isMainSelected
    ? 'Main Cohort'
    : (cohortDescriptions?.[activeChart.cohortName]?.display_name || activeChart.label);

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle} style={{ color: groupColor }}>
        {cohortDescriptions?.[parent]?.display_name || parent}
      </div>

      {hasMultiple && (
        <div className={styles.subtitleWrapper}>
          <div
            ref={subtitleRef}
            className={`${styles.cardSubtitle} ${menuOpen ? styles.cardSubtitleActive : ''}`}
            onMouseEnter={() => { cancelClose(); setMenuOpen(true); }}
            onMouseLeave={scheduleClose}
          >
            <div className={styles.subtitleDot} style={{ backgroundColor: activeChart.color }} />
            <span>{subtitleLabel}</span>
            <span className={styles.subtitleChevron}>▾</span>
          </div>

          {menuOpen && subtitleRef.current && (() => {
            const rect = subtitleRef.current!.getBoundingClientRect();
            return (
              <Portal>
                <div
                  ref={menuRef}
                  className={styles.dropdownMenu}
                  style={{ position: 'fixed', top: rect.bottom + 2, left: rect.left }}
                  onMouseEnter={cancelClose}
                  onMouseLeave={() => setMenuOpen(false)}
                >
              {charts.map((chart) => {
                const finalN = getFinalCount(chart.rows);
                const isActive = chart.cohortName === activeChart.cohortName;
                const label = chart.cohortName === parent
                  ? 'Main Cohort'
                  : (cohortDescriptions?.[chart.cohortName]?.display_name || chart.label);
                return (
                  <button
                    key={chart.cohortName}
                    className={`${styles.menuItem} ${isActive ? styles.menuItemActive : ''}`}
                    onClick={() => { setSelectedCohort(chart.cohortName); setMenuOpen(false); }}
                  >
                    <div className={styles.menuDot} style={{ backgroundColor: chart.color }} />
                    <span className={styles.menuLabel}>{label}</span>
                    <span className={styles.menuN}>{fmtN(finalN)}</span>
                  </button>
                );
              })}
            </div>
              </Portal>
            );
          })()}
        </div>
      )}

      <AttritionCellRenderer
        rows={activeChart.rows}
        cohortId={activeChart.cohortName}
        databaseSize={activeChart.databaseSize}
        parentRowNames={
          !isMainSelected && hasMultiple ? parentRowNames : undefined
        }
        sharedRowMode={sharedRowMode}
        hoveredParentRow={hoveredParentRow}
        onParentRowHover={onParentRowHover}
      />
    </div>
  );
};
