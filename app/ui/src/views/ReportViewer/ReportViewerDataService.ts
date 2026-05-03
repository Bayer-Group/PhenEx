import { api } from '@/api/httpClient';
import type { Table1Data, CohortEntry } from './types';

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
  const { data } = await api.get<Record<string, string>>(
    `${BASE}/runs/${encodeURIComponent(runId)}/info`,
  );
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

/** Fetch value distributions for a specific variable or all variables. */
export async function fetchDistributions(
  runId: string,
  cohortName: string,
  variable?: string,
  report: 'table1' | 'table1_outcomes' = 'table1',
): Promise<Record<string, number[]>> {
  const { data } = await api.get<Record<string, number[]>>(
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
