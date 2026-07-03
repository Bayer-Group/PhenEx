import { FC, useMemo, useState, useCallback } from 'react';
import { type CohortClassified, type CohortGroup, type CohortDescriptions, getCohortColor } from '../types';
import { AttritionTableCellRenderer, DEFAULT_COLUMNS, type ColumnConfig } from './RowRenderers/AttritionTableCellRenderer';
import { AttritionControls } from './AttritionControls';
import { buildFlatRows, type BarChartSpacer, SPACER_UNIT_PX } from './RowRenderers/barChartShared';
import { LegendDot } from '../LeftPanels/CohortSelector/LegendDot';
import { type ColorUsage } from '../LeftPanels/CohortSelector/ColorPicker';
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
  spacers?: BarChartSpacer[];
  onSetColor?: (cohortName: string, color: string) => void;
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

/** Flat entry for table rendering: one cohort row or a spacer in legend order */
type FlatTableEntry =
  | {
      kind: 'cohort';
      cohortName: string;
      displayName: string;
      mainCohortDisplayName: string;
      subcohortDisplayName: string | null;
      color: string;
      /** Color of the parent cohort; undefined when this entry is the parent itself */
      parentColor: string | undefined;
      rows: any[];
      parentRowNames: Set<string>;
      isParent: boolean;
    }
  | {
      kind: 'spacer';
      id: string;
      size: number;
      label?: string;
    };

export const AttritionChart: FC<AttritionChartProps> = ({ cohortData, waterfall, groups, cohortDescriptions, spacers = [], onSetColor }) => {
  const selectedSet = useMemo(() => new Set(cohortData.map((cd) => cd.name)), [cohortData]);
  const [tableColumns, setTableColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [hideMainCohortRows, setHideMainCohortRows] = useState(true);

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

  /** Flat list in legend order (cohortData order), cohort entries interleaved with spacers. */
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

    const cohortDisplayNameMap = new Map(
      cohortData.map((cd) => [cd.name, cohortDescriptions?.[cd.name]?.display_name ?? cd.displayName ?? cd.name]),
    );

    const cohortEntries = buildFlatRows(cohortData)
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
        const mainCohortDisplayName = cohortDisplayNameMap.get(parentName) ?? parentName;
        const subcohortDisplayName = isParent
          ? null
          : cohortDescriptions?.[cohort.name]?.display_name ?? cohort.displayName ?? label;

        return {
          kind: 'cohort' as const,
          cohortName: cohort.name,
          displayName: cohortDescriptions?.[cohort.name]?.display_name ?? cohort.displayName ?? label,
          mainCohortDisplayName,
          subcohortDisplayName,
          color: chart.color,
          parentColor,
          rows: chart.rows,
          parentRowNames,
          isParent,
        };
      })
      .filter((e): e is Extract<FlatTableEntry, { kind: 'cohort' }> => e !== null);

    // Interleave spacers by afterIndex (afterIndex -1 = before first cohort).
    const result: FlatTableEntry[] = [];
    const emitSpacersAfter = (index: number) => {
      spacers.forEach((s, i) => {
        if (s.afterIndex === index) {
          result.push({ kind: 'spacer', id: `spacer-${index}-${i}`, size: s.size, label: s.label });
        }
      });
    };

    emitSpacersAfter(-1);
    cohortEntries.forEach((entry, index) => {
      result.push(entry);
      emitSpacersAfter(index);
    });

    return result;
  }, [cohortData, groupedCharts, cohortDescriptions, spacers]);

  // Build the list of used colors for a given cohort's picker
  const usedColorsFor = useCallback(
    (cohortName: string): ColorUsage[] => {
      return flatTableEntries.flatMap((entry) => {
        if (entry.kind !== 'cohort' || entry.cohortName === cohortName) return [];
        return [{ color: entry.color, cohortLabel: entry.displayName }];
      });
    },
    [flatTableEntries],
  );

  if (!groupedCharts.length) return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.infoAndControls}>
        <div className={styles.infoText}>
            On this page we see how study entry criterion and all inclusion and exclusion criteria affect the final cohort size. <br></br><br></br>
            Each card below is a single cohort or subcohort. The first row is always the study entry criterion, which defines the study entry date for each cohort. 
            The subsequent rows are inclusion criteria (which all patients must fulfill at study entry date) and exclusion criteria (which may not be present at study entry date).
            <br></br><br></br>
            You can customize the columns displayed to the right. To reorder, group, or change colors of cohorts, use the figure legend in the left panel.
            <br></br><br></br>
        </div>
        <AttritionControls
          columns={tableColumns}
          onColumnsChange={setTableColumns}
          hideMainCohortRows={hideMainCohortRows}
          onHideMainCohortRowsChange={setHideMainCohortRows}
        />
      </div>

      {/* Table — one row per cohort in legend order, stacked vertically, with spacers */}
      <div className={styles.tableStack}>
        {flatTableEntries.map((entry) => {
          if (entry.kind === 'spacer') {
            return (
              <div
                key={entry.id}
                className={styles.spacerRow}
                style={{ marginTop: entry.size * SPACER_UNIT_PX * 4 }}
                aria-hidden={!entry.label}
              >
                {entry.label && <span className={styles.spacerLabel}>{entry.label}</span>}
              </div>
            );
          }
          return (
            <div key={entry.cohortName} className={styles.tableRow}>
              <div className={styles.tableRowLabel}>
                <span className={styles.tableRowDot}>
                  <LegendDot
                    color={entry.isParent ? entry.color : entry.parentColor}
                    isActive
                    showDot
                    onClick={() => {}}
                    onColorChange={
                      onSetColor
                        ? (c) => {
                            const targetCohort = entry.isParent
                              ? entry.cohortName
                              : entry.cohortName.substring(0, entry.cohortName.indexOf('__'));
                            onSetColor(targetCohort, c);
                          }
                        : undefined
                    }
                    usedColors={usedColorsFor(
                      entry.isParent ? entry.cohortName : entry.cohortName.substring(0, entry.cohortName.indexOf('__')),
                    )}
                  />
                </span>
                <div className={styles.tableRowLabelText}>
                  <span className={styles.tableRowMainCohortName}>{entry.mainCohortDisplayName}</span>
                  <span className={styles.tableRowLabelSeparator}>⋅</span>
                  {!entry.isParent && (
                    <span className={styles.tableRowDot}>
                      <LegendDot
                        color={entry.color}
                        isActive
                        showDot
                        onClick={() => {}}
                        onColorChange={onSetColor ? (c) => onSetColor(entry.cohortName, c) : undefined}
                        usedColors={usedColorsFor(entry.cohortName)}
                      />
                    </span>
                  )}
                  <span className={styles.tableRowSubcohortName}>
                    {entry.subcohortDisplayName ?? 'Main Cohort'}
                  </span>
                </div>
                <div className={styles.tableRowFinalCohort}>
                <span className={styles.finalCohortArrow}>→</span>
                  <span className={styles.tableRowFinalCohortLabel}>Final Cohort Size</span>
                  <span className={styles.tableRowFinalCohortValue}>
                    <strong>
                      {(() => {
                        const last = [...entry.rows].reverse().find((r: any) => (r.Remaining ?? r.count) != null);
                        const n: number | null = last ? (last.Remaining ?? last.count ?? null) : null;
                        return n != null ? n.toLocaleString() : '–';
                      })()}
                    </strong>
                  </span>
                </div>
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
          );
        })}
      </div>
    </div>
  );
};
