import { FC, useMemo, useState } from 'react';
import { type CohortClassified, type CohortGroup, type CohortDescriptions, getCohortColor } from '../types';
import { AttritionTableCellRenderer, DEFAULT_COLUMNS, type ColumnConfig } from './RowRenderers/AttritionTableCellRenderer';
import { AttritionControls } from './AttritionControls';
import { buildFlatRows } from './RowRenderers/barChartShared';
import styles from './AttritionChart.module.css';

/** Shape of a single row in waterfall.json */
interface WaterfallRow {
  Type: 'info' | 'entry' | 'inclusion' | 'exclusion';
  Index: string;
  Name: string;
  N: number | null;
  Pct_N: number | null;
  Remaining: number | null;
  Pct_Remaining: number | null;
  Delta: number | null;
  Pct_Source_Database: number | null;
}

/** Shape of a single cohort's waterfall payload */
interface WaterfallPayload {
  reporter_type?: string;
  rows: WaterfallRow[];
}

interface AttritionChartProps {
  cohortData: CohortClassified[];
  waterfall: Record<string, unknown>;
  groups: CohortGroup[];
  cohortDescriptions?: CohortDescriptions;
}


function getDatabaseSize(rows: WaterfallRow[]): number | null {
  const dbRow = rows.find((r) => r.Type === 'info' && r.Remaining != null && r.Name !== 'Final Cohort Size');
  return dbRow?.Remaining ?? null;
}

interface ChartEntry {
  cohortName: string;
  label: string;
  color: string;
  rows: any[];
  databaseSize: number | null;
}

interface GroupedCharts {
  parent: string;
  groupColor: string;
  charts: ChartEntry[];
  parentRowNames: Set<string>;
}

/** Flat entry for table rendering: one row per cohort in legend order */
interface FlatTableEntry {
  cohortName: string;
  displayName: string;
  color: string;
  /** Color of the parent cohort; undefined when this entry is the parent itself */
  parentColor: string | undefined;
  rows: any[];
  parentRowNames: Set<string>;
  isParent: boolean;
}

export const AttritionChart: FC<AttritionChartProps> = ({ cohortData, waterfall, groups, cohortDescriptions }) => {
  const selectedSet = useMemo(() => new Set(cohortData.map((cd) => cd.name)), [cohortData]);
  const [tableColumns, setTableColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [hideMainCohortRows, setHideMainCohortRows] = useState(false);

  /** Build per-group chart data, grouping subcohorts under their main cohort. */
  const groupedCharts = useMemo(() => {
    const result: GroupedCharts[] = [];

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      const charts: ChartEntry[] = [];

      for (let si = 0; si < group.subcohorts.length; si++) {
        const sub = group.subcohorts[si];
        if (!selectedSet.has(sub.fullName)) continue;

        const raw = waterfall[sub.fullName];
        if (!raw) continue;
        const rows: WaterfallRow[] = Array.isArray(raw) ? raw : (raw as WaterfallPayload).rows;
        if (!rows?.length) continue;

        const resolvedColor =
          cohortData.find((cd) => cd.name === sub.fullName)?.color ??
          getCohortColor(gi, si, group.subcohorts.length);

        charts.push({
          cohortName: sub.fullName,
          label: sub.label,
          color: resolvedColor,
          rows: rows.filter((r) => r.Type !== 'info'),
          databaseSize: getDatabaseSize(rows),
        });
      }

      if (charts.length > 0) {
        const mainChart = charts.find((c) => c.cohortName === group.parent);
        const parentRowNames = new Set(
          mainChart ? mainChart.rows.map((r: any) => (r.Name ?? r.name) as string) : [],
        );

        const parentColor =
          cohortData.find((cd) => cd.name === group.parent)?.color ??
          getCohortColor(gi, 0, group.subcohorts.length);

        result.push({
          parent: group.parent,
          groupColor: parentColor,
          charts,
          parentRowNames,
        });
      }
    }

    return result;
  }, [groups, waterfall, selectedSet, cohortData]);

  /** Flat list in legend order (cohortData order), one entry per cohort. */
  const flatTableEntries = useMemo<FlatTableEntry[]>(() => {
    const chartByName = new Map<string, ChartEntry>();
    const parentRowsByParent = new Map<string, Set<string>>();
    for (const group of groupedCharts) {
      parentRowsByParent.set(group.parent, group.parentRowNames);
      for (const chart of group.charts) {
        chartByName.set(chart.cohortName, chart);
      }
    }

    const parentNames = new Set(groupedCharts.map((g) => g.parent));

    return buildFlatRows(cohortData)
      .map(({ cohort, label }) => {
        const chart = chartByName.get(cohort.name);
        if (!chart) return null;
        const isParent = parentNames.has(cohort.name);
        const parentName = cohort.name.includes('__')
          ? cohort.name.substring(0, cohort.name.indexOf('__'))
          : cohort.name;
        const parentRowNames = isParent
          ? new Set<string>()
          : (parentRowsByParent.get(parentName) ?? new Set<string>());
        const parentColor = isParent ? undefined : chartByName.get(parentName)?.color;
        return {
          cohortName: cohort.name,
          displayName: cohortDescriptions?.[cohort.name]?.display_name ?? cohort.displayName ?? label,
          color: chart.color,
          parentColor,
          rows: chart.rows,
          parentRowNames,
          isParent,
        };
      })
      .filter((e): e is FlatTableEntry => e !== null);
  }, [cohortData, groupedCharts, cohortDescriptions]);

  if (!groupedCharts.length) return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.controlsRow}>
        <AttritionControls
          columns={tableColumns}
          onColumnsChange={setTableColumns}
          hideMainCohortRows={hideMainCohortRows}
          onHideMainCohortRowsChange={setHideMainCohortRows}
        />
      </div>

      {/* Table — one row per cohort in legend order, stacked vertically */}
      <div className={styles.tableStack}>
        {flatTableEntries.map((entry) => (
          <div key={entry.cohortName} className={styles.tableRow}>
            <div className={styles.tableRowLabel}>
              <span className={styles.tableRowDot} style={{ backgroundColor: entry.color }} />
              <span>{entry.displayName}</span>
            </div>
            <AttritionTableCellRenderer
              rows={entry.rows}
              columns={tableColumns}
              parentRowNames={entry.isParent ? undefined : entry.parentRowNames}
              color={entry.color}
              parentColor={entry.parentColor}
              hideParentRows={hideMainCohortRows}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
