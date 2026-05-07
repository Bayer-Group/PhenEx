import { FC, useMemo } from 'react';
import { CohortDefinitionReportD3 } from '../StudyViewer/StudyViewerCohortDefinitions/CohortDefinitionReportD3';
import { type CohortClassified } from './types';
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
}

/**
 * Convert waterfall JSON rows into the row format expected by
 * CohortDefinitionReportD3 (name, count, effective_type, etc.).
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

export const AttritionChart: FC<AttritionChartProps> = ({ cohortData, waterfall }) => {
  /** Build per-cohort D3 row arrays from the combined waterfall data. */
  const charts = useMemo(() => {
    return cohortData
      .map((cd) => {
        const payload = waterfall[cd.name] as WaterfallPayload | undefined;
        if (!payload?.rows?.length) return null;
        return {
          cohortName: cd.name,
          color: cd.color,
          rows: waterfallToD3Rows(payload.rows),
        };
      })
      .filter(Boolean) as { cohortName: string; color: string; rows: any[] }[];
  }, [cohortData, waterfall]);

  if (!charts.length) return null;

  return (
    <div className={styles.container}>
      {charts.map((chart) => (
        <div key={chart.cohortName} className={styles.cohortBlock}>
          <div className={styles.cohortTitle} style={{ color: chart.color }}>
            {chart.cohortName}
          </div>
          <div className={styles.d3Wrapper}>
            <CohortDefinitionReportD3
              rows={chart.rows}
              cohortId={chart.cohortName}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
