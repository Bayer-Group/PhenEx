import { api } from '@/api/httpClient';
import type { Table1Data, CohortEntry, Table2Row, TimeToEventRow, CohortDescriptions, ReportsPayload } from './types';

const BASE = '/report';

/** List available run IDs (timestamp directories). */
export async function fetchRuns(): Promise<string[]> {
  const { data } = await api.get<string[]>(`${BASE}/runs`);
  return data;
}

/** List cohort names inside a run. */
export async function fetchCohorts(runId: string): Promise<string[]> {
  const { data } = await api.get<string[]>(`${BASE}/runs/${encodeURIComponent(runId)}/cohorts`);
  return data;
}

/** Fetch run metadata (info.txt). */
export async function fetchRunInfo(runId: string): Promise<Record<string, string>> {
  const url = `${BASE}/runs/${encodeURIComponent(runId)}/info`;
  console.log(`[DataService] GET ${url}`);
  const { data } = await api.get<Record<string, string>>(url);
  console.log(`[DataService] info: ${Object.keys(data).length} keys`);
  return data;
}

/** Fetch table1 rows + sections (no distributions) for a single cohort. */
export async function fetchTable1(
  runId: string,
  cohortName: string,
  report: 'table1' | 'table1_outcomes' = 'table1',
): Promise<Table1Data> {
  const { data } = await api.get<Table1Data>(
    `${BASE}/runs/${encodeURIComponent(runId)}/cohorts/${encodeURIComponent(cohortName)}/table1`,
    { params: { report } },
  );
  return data;
}

/** KDE curve for a numeric variable: x grid + y normalised 0–100. */
export interface KdeCurve {
  x: number[];
  y: number[];
}

/** Fetch KDE curves for numeric variables. */
export async function fetchDistributions(
  runId: string,
  cohortName: string,
  variable?: string,
  report: 'table1' | 'table1_outcomes' = 'table1',
): Promise<Record<string, KdeCurve>> {
  const { data } = await api.get<Record<string, KdeCurve>>(
    `${BASE}/runs/${encodeURIComponent(runId)}/cohorts/${encodeURIComponent(cohortName)}/table1/distributions`,
    { params: { report, ...(variable ? { variable } : {}) } },
  );
  return data;
}

/** Fetch table1 data for multiple cohorts in parallel. */
export async function fetchAllCohortTable1(
  runId: string,
  cohortNames: string[],
  report: 'table1' | 'table1_outcomes' = 'table1',
): Promise<CohortEntry[]> {
  const results = await Promise.all(
    cohortNames.map(async (cohortName) => {
      try {
        const data = await fetchTable1(runId, cohortName, report);
        return { cohortName, data } as CohortEntry;
      } catch {
        return null;
      }
    }),
  );
  return results.filter((r): r is CohortEntry => r !== null);
}

/** Fetch combined table1 data for all cohorts in a single request. */
export async function fetchCombinedTable1(
  runId: string,
  report: 'table1' | 'table1_outcomes' = 'table1',
): Promise<CohortEntry[]> {
  const url = `${BASE}/runs/${encodeURIComponent(runId)}/table1_combined`;
  console.log(`[DataService] GET ${url}`);
  const { data } = await api.get<Record<string, Table1Data>>(url, { params: { report } });
  console.log(`[DataService] table1_combined: ${Object.keys(data).length} cohorts`);
  return Object.entries(data).map(([cohortName, table1]) => ({
    cohortName,
    data: table1,
  }));
}

/** Fetch all frozen cohort definitions (codelists stripped) for a run. */
export async function fetchFrozenCohortsCombined(runId: string): Promise<Record<string, unknown>[]> {
  const url = `${BASE}/runs/${encodeURIComponent(runId)}/frozen_cohorts_combined`;
  console.log(`[DataService] GET ${url}`);
  const { data } = await api.get<Record<string, unknown>[]>(url);
  console.log(`[DataService] frozen_cohorts_combined: ${data.length} items`);
  return data;
}

/** Fetch combined waterfall data for all cohorts in a single request. */
export async function fetchWaterfallCombined(
  runId: string,
): Promise<Record<string, unknown>> {
  const url = `${BASE}/runs/${encodeURIComponent(runId)}/waterfall_combined`;
  console.log(`[DataService] GET ${url}`);
  const { data } = await api.get<Record<string, unknown>>(url);
  console.log(`[DataService] waterfall_combined: ${Object.keys(data).length} cohorts`);
  return data;
}

/** Fetch combined KDE distributions for all cohorts in a single request. */
export async function fetchKdeCombined(
  runId: string,
  report: 'table1' | 'table1_outcomes' = 'table1',
): Promise<Record<string, Record<string, KdeCurve>>> {
  const url = `${BASE}/runs/${encodeURIComponent(runId)}/kde_combined`;
  console.log(`[DataService] GET ${url}`);
  const { data } = await api.get<Record<string, Record<string, KdeCurve>>>(url, { params: { report } });
  console.log(`[DataService] kde_combined: ${Object.keys(data).length} cohorts`);
  return data;
}

/** Request AI analysis comparing selected cohorts. */
export async function fetchReportAnalysis(
  runId: string,
  cohortNames: string[],
): Promise<{ analysis: Record<string, string>; cohorts_analyzed: string[] }> {
  const { data } = await api.post<{
    analysis: Record<string, string>;
    cohorts_analyzed: string[];
  }>(`${BASE}/analyze`, { run_id: runId, cohort_names: cohortNames });
  return data;
}

/** Fetch combined Table2 incidence-rate data for all cohorts. */
export async function fetchTable2Combined(
  runId: string,
): Promise<Record<string, Table2Row[]>> {
  const url = `${BASE}/runs/${encodeURIComponent(runId)}/table2_combined`;
  const { data } = await api.get<Record<string, Table2Row[]>>(url);
  return data;
}

/** Fetch combined time-to-event (Kaplan–Meier) data for all cohorts. */
export async function fetchTimeToEventCombined(
  runId: string,
): Promise<Record<string, TimeToEventRow[]>> {
  const url = `${BASE}/runs/${encodeURIComponent(runId)}/time_to_event_combined`;
  const { data } = await api.get<Record<string, TimeToEventRow[]>>(url);
  return data;
}

/** Fetch the study registry (row metadata, comments). */
export async function fetchStudyRegistry(
  runId: string,
): Promise<Record<string, unknown>> {
  const url = `${BASE}/runs/${encodeURIComponent(runId)}/study_registry`;
  const { data } = await api.get<Record<string, unknown>>(url);
  return data;
}

/** Fetch cohort descriptions (cohort_name → {display_name, description}). */
export async function fetchCohortDescriptions(
  runId: string,
): Promise<CohortDescriptions> {
  const url = `${BASE}/runs/${encodeURIComponent(runId)}/cohort_descriptions`;
  const { data } = await api.get<CohortDescriptions>(url);
  return data;
}

/** Fetch reports definitions. */
export async function fetchReports(
  runId: string,
): Promise<ReportsPayload> {
  const url = `${BASE}/runs/${encodeURIComponent(runId)}/reports`;
  const { data } = await api.get<ReportsPayload>(url);
  return data;
}
