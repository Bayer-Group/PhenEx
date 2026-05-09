/**
 * Local-storage cache for report data.
 *
 * Stores three pieces per run:
 *   - cohort entries (from combined_table1.json)
 *   - frozen cohort definitions (from combined_frozen_cohorts.json)
 *   - run info (from info.txt)
 */

import type { CohortEntry, LegendSelection, Table2Row, TimeToEventRow } from './types';

const PREFIX = 'phenex:report:';
const SEL_PREFIX = 'phenex:report:sel:';

/** Core run data cached in localStorage. */
export interface RunData {
  entries: CohortEntry[];
  outcomesEntries: CohortEntry[];
  info: Record<string, string>;
  waterfall: Record<string, unknown>;
}

function runKey(runId: string): string {
  return `${PREFIX}run:${runId}`;
}

/** Read cached run data. Returns null on miss or corrupt data. */
export function getCached(runId: string): RunData | null {
  try {
    const raw = localStorage.getItem(runKey(runId));
    if (!raw) return null;
    return JSON.parse(raw) as RunData;
  } catch {
    return null;
  }
}

/** Write run data to cache. */
export function setCache(runId: string, data: RunData): void {
  try {
    const json = JSON.stringify(data);
    localStorage.setItem(runKey(runId), json);
    console.debug(`[reportCache] cached ${runId} (${(json.length / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.warn('[reportCache] failed to cache — localStorage may be full', e);
  }
}

/** Delete the cache for a single run. */
export function clearCache(runId: string): void {
  localStorage.removeItem(runKey(runId));
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

// ── Table2 / TimeToEvent caches (separate entries to keep RunData small) ─

function table2Key(runId: string): string { return `${PREFIX}table2:${runId}`; }
function tteKey(runId: string): string { return `${PREFIX}tte:${runId}`; }

export function getCachedTable2(runId: string): Record<string, Table2Row[]> | null {
  try {
    const raw = localStorage.getItem(table2Key(runId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setCachedTable2(runId: string, data: Record<string, Table2Row[]>): void {
  try { localStorage.setItem(table2Key(runId), JSON.stringify(data)); }
  catch { /* localStorage full */ }
}

export function getCachedTimeToEvent(runId: string): Record<string, TimeToEventRow[]> | null {
  try {
    const raw = localStorage.getItem(tteKey(runId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setCachedTimeToEvent(runId: string, data: Record<string, TimeToEventRow[]>): void {
  try { localStorage.setItem(tteKey(runId), JSON.stringify(data)); }
  catch { /* localStorage full */ }
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
