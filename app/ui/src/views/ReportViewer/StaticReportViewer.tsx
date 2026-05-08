/**
 * Static (offline) version of the ReportViewer.
 *
 * Reads all data from `window.__REPORT_DATA__` (embedded in the HTML at
 * build time by the Python writer) and renders the full report with no
 * network requests.  Designed to be bundled into a single HTML file via
 * vite-plugin-singlefile.
 */
import { FC, useMemo } from 'react';
import { ReportViewer } from './ReportViewer';
import type { KdeCurve } from './types';
import type { CohortEntry } from './types';

// ── Embedded data interface ─────────────────────────────────────────────

interface EmbeddedReportData {
  table1: Record<string, { rows: unknown[]; sections: Record<string, string[]> }>;
  table1_outcomes?: Record<string, { rows: unknown[]; sections: Record<string, string[]> }>;
  kdes?: Record<string, Record<string, KdeCurve>>;
  kdes_outcomes?: Record<string, Record<string, KdeCurve>>;
  waterfall?: Record<string, unknown>;
  info?: Record<string, string>;
  runId?: string;
}

declare global {
  interface Window {
    __REPORT_DATA__?: EmbeddedReportData;
  }
}

function buildEntries(
  table: Record<string, { rows: unknown[]; sections: Record<string, string[]> }>,
  kdes?: Record<string, Record<string, KdeCurve>>,
): CohortEntry[] {
  return Object.entries(table).map(([cohortName, data]) => ({
    cohortName,
    data: {
      rows: data.rows as CohortEntry['data']['rows'],
      sections: data.sections,
      kdes: kdes?.[cohortName],
    },
  }));
}

// ── Component ───────────────────────────────────────────────────────────

export const StaticReportViewer: FC = () => {
  const reportData = window.__REPORT_DATA__;

  const allCohortEntries = useMemo(
    () => (reportData?.table1 ? buildEntries(reportData.table1, reportData.kdes) : []),
    [reportData],
  );

  const allOutcomesEntries = useMemo(
    () => (reportData?.table1_outcomes ? buildEntries(reportData.table1_outcomes, reportData.kdes_outcomes) : []),
    [reportData],
  );

  const waterfallData = useMemo(
    () => (reportData?.waterfall ?? {}) as Record<string, unknown>,
    [reportData],
  );

  if (!reportData) {
    return <div style={{ padding: 40, color: '#999' }}>No report data embedded.</div>;
  }

  return (
    <ReportViewer
      allCohortEntries={allCohortEntries}
      allOutcomesEntries={allOutcomesEntries}
      waterfallData={waterfallData}
      runId={reportData.runId ?? null}
      title="PhenEx Report"
    />
  );
};
