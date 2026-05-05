/**
 * Local-storage cache for report data.
 *
 * Each run's combined table1 payload is stored under a namespaced key
 * so subsequent visits skip the network fetch entirely.
 */

import type { CohortEntry, LegendSelection } from './types';

const PREFIX = 'phenex:report:';
const SEL_PREFIX = 'phenex:report:sel:';

/** Build the storage key for a run + report combination. */
function cacheKey(runId: string, report: string = 'table1'): string {
  return `${PREFIX}${report}:${runId}`;
}

/** Read cached entries. Returns null on miss or corrupt data. */
export function getCached(runId: string, report: string = 'table1'): CohortEntry[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(runId, report));
    if (!raw) return null;
    return JSON.parse(raw) as CohortEntry[];
  } catch {
    return null;
  }
}

/** Write entries to cache. Logs a warning on quota errors. */
export function setCache(runId: string, entries: CohortEntry[], report: string = 'table1'): void {
  try {
    const json = JSON.stringify(entries);
    localStorage.setItem(cacheKey(runId, report), json);
    console.debug(`[reportCache] cached ${runId} (${(json.length / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.warn('[reportCache] failed to cache — localStorage may be full', e);
  }
}

/** Delete the cache for a single run. */
export function clearCache(runId: string, report: string = 'table1'): void {
  localStorage.removeItem(cacheKey(runId, report));
}

/** Delete all cached report data. */
export function clearAllCaches(): void {
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) toRemove.push(key);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
}

/** List run IDs that are currently cached. */
export function listCachedRuns(): string[] {
  const runs: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) {
      // key format: phenex:report:<report>:<runId>
      const runId = key.slice(key.lastIndexOf(':') + 1);
      if (runId && !runs.includes(runId)) runs.push(runId);
    }
  }
  return runs.sort();
}

// ── Selection persistence ───────────────────────────────────────────────

/** Save the current cohort selections for a run. */
export function saveSelections(runId: string, selections: LegendSelection[]): void {
  try {
    localStorage.setItem(`${SEL_PREFIX}${runId}`, JSON.stringify(selections));
  } catch { /* ignore */ }
}

/** Restore saved cohort selections for a run. */
export function loadSelections(runId: string): LegendSelection[] | null {
  try {
    const raw = localStorage.getItem(`${SEL_PREFIX}${runId}`);
    if (!raw) return null;
    return JSON.parse(raw) as LegendSelection[];
  } catch {
    return null;
  }
}

/** Clear saved selections for a run. */
export function clearSelections(runId: string): void {
  localStorage.removeItem(`${SEL_PREFIX}${runId}`);
}
