import { FC, useCallback, useMemo } from 'react';
import { type Table2Row, type TimeToEventRow } from '../types';
import { type SequentialRow } from '../studyRegistryUtils';
import { KaplanMeierCellRenderer, type KMCurve } from './RowRenderers/KaplanMeierCellRenderer';
import { useBarHoverStore } from './RowRenderers/useBarHoverStore';
import { useClickGuard } from './useClickGuard';
import styles from './OutcomesChart.module.css';

/* ── Types ───────────────────────────────────────────────────────────── */

export interface OutcomesCohort {
  name: string;
  color: string;
  table2: Table2Row[];
  timeToEvent: TimeToEventRow[];
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

const TABLE2_COLS = ['N_Events', 'N_Censored', 'Incidence_Rate'] as const;
const TABLE2_LABELS: Record<string, string> = {
  N_Events: 'Events',
  N_Censored: 'Censored',
  Incidence_Rate: 'IR',
};

const fmt = (v: number | null | undefined) => {
  if (v == null || isNaN(v)) return '–';
  return v % 1 !== 0 ? v.toFixed(1) : String(v);
};

/* ── Component ───────────────────────────────────────────────────────── */

interface OutcomesChartProps {
  cohorts: OutcomesCohort[];
}

export const OutcomesChart: FC<OutcomesChartProps> = ({ cohorts }) => {
  // Collect unique outcome names across all cohorts (TTE + Table2)
  const outcomes = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const c of cohorts) {
      for (const r of c.timeToEvent) {
        if (!seen.has(r.Outcome)) { seen.add(r.Outcome); order.push(r.Outcome); }
      }
      for (const r of c.table2) {
        if (!seen.has(r.Outcome)) { seen.add(r.Outcome); order.push(r.Outcome); }
      }
    }
    return order;
  }, [cohorts]);

  if (!outcomes.length) return null;

  return (
    <div className={styles.container}>
      {outcomes.map((outcome) => (
        <OutcomeRow key={outcome} outcome={outcome} cohorts={cohorts} />
      ))}
    </div>
  );
};

/* ── Per-outcome row ─────────────────────────────────────────────────── */

const OutcomeRow: FC<{ outcome: string; cohorts: OutcomesCohort[] }> = ({
  outcome,
  cohorts,
}) => {
  const { activeIndex, onClick } = useBarHoverStore();

  // Build KM curves for this outcome
  const kmCurves: KMCurve[] = useMemo(
    () =>
      cohorts
        .map((c) => ({
          color: c.color,
          cohortName: c.name,
          steps: c.timeToEvent.filter((r) => r.Outcome === outcome),
        }))
        .filter((c) => c.steps.length > 0),
    [cohorts, outcome],
  );

  // Build Table2 data for this outcome, per cohort
  const table2Rows = useMemo(
    () =>
      cohorts.map((c) => ({
        cohort: c,
        row: c.table2.find((r) => r.Outcome === outcome),
      })),
    [cohorts, outcome],
  );

  const hasTable2 = table2Rows.some((t) => t.row);

  return (
    <div className={styles.row}>
      <div className={styles.nameCell}>{outcome}</div>
      <div className={styles.kmCell}>
        <KaplanMeierCellRenderer curves={kmCurves} />
      </div>
      {hasTable2 && (
        <div className={styles.statsGrid}>
          <div className={styles.statsHeaderRow}>
            <div className={styles.statsCohortCell} />
            {TABLE2_COLS.map((k) => (
              <div key={k} className={styles.statsHeaderCell}>
                {TABLE2_LABELS[k] ?? k}
              </div>
            ))}
          </div>
          {table2Rows.map(({ cohort, row }, i) => {
            if (!row) return null;
            const dimmed = activeIndex !== null && activeIndex !== i;
            return (
              <div
                key={cohort.name}
                className={styles.statsRow}
                onClick={() => onClick(i)}
                style={{ opacity: dimmed ? 0.25 : 1, cursor: 'pointer' }}
              >
                <div className={styles.statsCohortCell}>
                  <span className={styles.statDot} style={{ backgroundColor: cohort.color }} />
                </div>
                {TABLE2_COLS.map((k) => (
                  <div key={k} className={styles.statsValueCell}>
                    {fmt(row[k])}
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

/* ── Table2Chart ─────────────────────────────────────────────────────── */

export interface Table2Cohort {
  name: string;
  color: string;
  table2: Table2Row[];
}

interface Table2ChartProps {
  cohorts: Table2Cohort[];
  /** Sequential rows for the Table2 reporter, used for ordering */
  reporterRows: SequentialRow[];
  /** Open the HorizontalRowViewer at the given sequential index */
  onOpen: (index: number) => void;
}

export const Table2Chart: FC<Table2ChartProps> = ({
  cohorts,
  reporterRows,
  onOpen,
}) => {
  if (!reporterRows.length) return null;

  return (
    <div className={styles.container}>
      {reporterRows.map((seqRow) => {
        const rows = cohorts.map((c) => ({
          cohort: c,
          row: c.table2.find((r) => r.Outcome === seqRow.name),
        }));
        if (!rows.some((t) => t.row)) return null;
        return <Table2RowComponent key={seqRow.name} outcome={seqRow.name} rows={rows} onClick={() => onOpen(seqRow.index)} />;
      })}
    </div>
  );
};

const Table2RowComponent: FC<{
  outcome: string;
  rows: { cohort: Table2Cohort; row: Table2Row | undefined }[];
  onClick?: () => void;
}> = ({ outcome, rows, onClick }) => {
  const { activeIndex, onClick: onBarClick } = useBarHoverStore();
  const guard = useClickGuard(onClick ?? (() => {}));
  return (
    <div className={styles.row} onMouseDown={guard.onMouseDown} onClick={guard.onClick} style={{ cursor: onClick ? 'pointer' : undefined }} data-row-name={outcome}>
      <div className={styles.nameCell}>{outcome}</div>
      <div className={styles.statsGrid}>
        <div className={styles.statsHeaderRow}>
          <div className={styles.statsCohortCell} />
          {TABLE2_COLS.map((k) => (
            <div key={k} className={styles.statsHeaderCell}>{TABLE2_LABELS[k] ?? k}</div>
          ))}
        </div>
        {rows.map(({ cohort, row }, i) => {
          if (!row) return null;
          const dimmed = activeIndex !== null && activeIndex !== i;
          return (
            <div key={cohort.name} className={styles.statsRow}
              onClick={(e) => { e.stopPropagation(); onBarClick(i); }}
              style={{ opacity: dimmed ? 0.25 : 1, cursor: 'pointer' }}>
              <div className={styles.statsCohortCell}>
                <span className={styles.statDot} style={{ backgroundColor: cohort.color }} />
              </div>
              {TABLE2_COLS.map((k) => (
                <div key={k} className={styles.statsValueCell}>{fmt(row[k])}</div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ── TimeToEventChart ────────────────────────────────────────────────── */

export interface TimeToEventCohort {
  name: string;
  color: string;
  timeToEvent: TimeToEventRow[];
}

interface TimeToEventChartProps {
  cohorts: TimeToEventCohort[];
  /** Sequential rows for the TimeToEvent reporter, used for ordering */
  reporterRows: SequentialRow[];
  /** Open the HorizontalRowViewer at the given sequential index */
  onOpen: (index: number) => void;
}

export const TimeToEventChart: FC<TimeToEventChartProps> = ({
  cohorts,
  reporterRows,
  onOpen,
}) => {
  if (!reporterRows.length) return null;

  return (
    <div className={styles.container}>
      {reporterRows.map((seqRow) => (
        <TimeToEventRowComponent key={seqRow.name} outcome={seqRow.name} cohorts={cohorts} onClick={() => onOpen(seqRow.index)} />
      ))}
    </div>
  );
};

const TimeToEventRowComponent: FC<{ outcome: string; cohorts: TimeToEventCohort[]; onClick?: () => void }> = ({ outcome, cohorts, onClick }) => {
  const kmCurves: KMCurve[] = useMemo(
    () => cohorts
      .map((c) => ({
        color: c.color,
        cohortName: c.name,
        steps: c.timeToEvent.filter((r) => r.Outcome === outcome),
      }))
      .filter((c) => c.steps.length > 0),
    [cohorts, outcome],
  );

  const guard = useClickGuard(onClick ?? (() => {}));

  if (!kmCurves.length) return null;

  return (
    <div className={styles.row} onMouseDown={guard.onMouseDown} onClick={guard.onClick} style={{ cursor: onClick ? 'pointer' : undefined }} data-row-name={outcome}>
      <div className={styles.nameCell}>{outcome}</div>
      <div className={styles.kmCell}>
        <KaplanMeierCellRenderer curves={kmCurves} />
      </div>
    </div>
  );
};
