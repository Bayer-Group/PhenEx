import { FC, useMemo, useState } from 'react';
import { type CohortClassified, type CohortGroup, type CohortDescriptions, getCohortColor } from '../types';
import { AttritionMainCohortCard } from './AttritionMainCohortCard';
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

/**
 * Convert waterfall JSON rows into the row format expected by
 * AttritionCellRenderer (name, count, effective_type, etc.).
 *
 * Skips the synthetic "info" rows (database size / final cohort) because
 * the D3 component adds those itself.
 */
function waterfallToD3Rows(rows: WaterfallRow[]) {
  return rows
    .filter((r) => r.Type !== 'info')
    .map((r) => ({
      name: r.Name,
      count: r.Remaining,
      effective_type: r.Type,
      hierarchical_index: r.Index,
      excluded_count: r.Delta !== null ? Math.abs(r.Delta) : undefined,
    }));
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

export const AttritionChart: FC<AttritionChartProps> = ({ cohortData, waterfall, groups, cohortDescriptions }) => {
  const selectedSet = useMemo(() => new Set(cohortData.map((cd) => cd.name)), [cohortData]);
  const [sharedRowMode, setSharedRowMode] = useState<'show' | 'hide' | 'dim'>('show');
  const [hoveredParentRow, setHoveredParentRow] = useState<string | null>(null);

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

        charts.push({
          cohortName: sub.fullName,
          label: sub.label,
          color: getCohortColor(gi, si, group.subcohorts.length),
          rows: waterfallToD3Rows(rows),
          databaseSize: getDatabaseSize(rows),
        });
      }

      if (charts.length > 0) {
        // Find parent (main) cohort's row names for shared-row detection
        const mainChart = charts.find((c) => c.cohortName === group.parent);
        const parentRowNames = new Set(
          mainChart ? mainChart.rows.map((r: any) => r.name as string) : [],
        );

        result.push({
          parent: group.parent,
          groupColor: getCohortColor(gi, 0, group.subcohorts.length),
          charts,
          parentRowNames,
        });
      }
    }

    return result;
  }, [groups, waterfall, selectedSet]);

  if (!groupedCharts.length) return null;

  const sharedModeLabels = { show: 'Showing', hide: 'Hidden', dim: 'Dimmed' } as const;
  const nextMode = { show: 'hide', hide: 'dim', dim: 'show' } as const;

  return (
    <div className={styles.wrapper}>
      <div className={styles.controls}>
        <button
          className={styles.toggleBtn}
          onClick={() => setSharedRowMode((m) => nextMode[m])}
        >
          Parent rows: {sharedModeLabels[sharedRowMode]}
        </button>
      </div>
      <div className={styles.container}>
        {groupedCharts.map((group) => (
          <AttritionMainCohortCard
            key={group.parent}
            parent={group.parent}
            groupColor={group.groupColor}
            charts={group.charts}
            parentRowNames={group.parentRowNames}
            cohortDescriptions={cohortDescriptions}
            sharedRowMode={sharedRowMode}
            hoveredParentRow={hoveredParentRow}
            onParentRowHover={setHoveredParentRow}
          />
        ))}
      </div>
    </div>
  );
};
