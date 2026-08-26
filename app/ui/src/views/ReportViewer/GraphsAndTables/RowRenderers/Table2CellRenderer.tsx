import { FC, useState, useRef } from 'react';
import { type Table2Row } from '../../types';
import { useBarHoverStore } from './useBarHoverStore';
import { CohortNameTooltip } from './CohortNameTooltip';
import styles from './Table2CellRenderer.module.css';

const COLS = ['N_Events', 'N_Censored', 'Time_Under_Risk', 'Incidence_Rate', 'Incidence_Rate_Per_Patient_Month'] as const;
type Col = typeof COLS[number];

const LABELS: Record<Col, string> = {
  N_Events: 'Events',
  N_Censored: 'Censored',
  Time_Under_Risk: 'Time at Risk',
  Incidence_Rate: 'IR',
  Incidence_Rate_Per_Patient_Month: 'IR/PM',
};

const fmt = (v: number | null | undefined): string => {
  if (v == null || isNaN(v)) return '–';
  if (v % 1 === 0) return v.toLocaleString();
  return v.toFixed(3);
};

export interface Table2CellRendererCohort {
  name: string;
  displayName?: string;
  color: string;
  table2: Table2Row[];
}

interface Table2CellRendererProps {
  outcome: string;
  cohorts: Table2CellRendererCohort[];
}

export const Table2CellRenderer: FC<Table2CellRendererProps> = ({ outcome, cohorts }) => {
  const { activeIndex, onClick } = useBarHoverStore();
  const [hover, setHover] = useState<{ index: number; x: number; top: number } | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement>>({});

  const timePoints = Array.from(
    new Set(
      cohorts.flatMap((c) =>
        c.table2.filter((r) => r.Outcome === outcome).map((r) => r.Time_Point),
      ),
    ),
  ).sort((a, b) => a - b);

  if (!timePoints.length) {
    return <div className={styles.empty}>No incidence rate data for this outcome.</div>;
  }

  return (
    <>
      <div className={styles.grid}>
        {/* Header */}
        <div className={styles.headerRow}>
          <div className={styles.cohortCell} />
          <div className={styles.timepointCell} />
          {COLS.map((k) => (
            <div key={k} className={styles.headerCell}>{LABELS[k]}</div>
          ))}
        </div>

        {/* Data rows: one block per cohort, one row per time-point */}
        {cohorts.map((cohort, ci) => {
          const cohortRows = timePoints
            .map((tp) => cohort.table2.find((r) => r.Outcome === outcome && r.Time_Point === tp))
            .filter((r): r is Table2Row => r != null);

          if (!cohortRows.length) return null;

          const dimmed = activeIndex !== null && activeIndex !== ci;

          return (
            <div key={cohort.name} className={styles.cohortBlock}>
              {cohortRows.map((row, tpIdx) => {
                const key = `${cohort.name}-${row.Time_Point}`;
                return (
                  <div
                    key={key}
                    ref={(el) => { if (el) rowRefs.current[key] = el; }}
                    className={styles.dataRow}
                    onClick={() => onClick(ci)}
                    onMouseEnter={(e) => {
                      const rect = rowRefs.current[key]?.getBoundingClientRect();
                      if (rect) setHover({ index: ci, x: e.clientX, top: rect.top });
                    }}
                    onMouseMove={(e) => {
                      const rect = rowRefs.current[key]?.getBoundingClientRect();
                      if (rect) setHover({ index: ci, x: e.clientX, top: rect.top });
                    }}
                    onMouseLeave={() => setHover(null)}
                    style={{ opacity: dimmed ? 0.25 : 1, cursor: 'pointer' }}
                  >
                    <div className={styles.cohortCell}>
                      {tpIdx === 0 && (
                        <span className={styles.dot} style={{ backgroundColor: cohort.color }} />
                      )}
                    </div>
                    <div className={styles.timepointCell}>{row.Time_Point}d</div>
                    {COLS.map((k) => (
                      <div key={k} className={styles.valueCell}>{fmt(row[k])}</div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {hover && (
        <CohortNameTooltip
          cohortData={cohorts}
          index={hover.index}
          x={hover.x}
          top={hover.top}
        />
      )}
    </>
  );
};
