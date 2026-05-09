import { FC, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ReportViewer } from './ReportViewer';
import {
  fetchRuns,
  fetchCombinedTable1,
  fetchFrozenCohortsCombined,
  fetchWaterfallCombined,
  fetchRunInfo,
  fetchReportAnalysis,
  fetchKdeCombined,
  fetchTable2Combined,
  fetchTimeToEventCombined,
} from './ReportViewerDataService';
import type { KdeCurve, Table2Row, TimeToEventRow } from './types';
import { getCached, setCache, getCachedTable2, setCachedTable2, getCachedTimeToEvent, setCachedTimeToEvent, saveSelections, loadSelections, type RunData } from './reportCache';
import {
  parseCohortGroups,
  type CohortEntry,
  type LegendSelection,
} from './types';

/** Merge combined KDE data into each cohort entry's `kdes` field. */
function mergeKdesIntoEntries(
  entries: CohortEntry[],
  kdes: Record<string, Record<string, KdeCurve>>,
): void {
  for (const entry of entries) {
    const cohortKdes = kdes[entry.cohortName];
    if (cohortKdes) {
      entry.data = { ...entry.data, kdes: cohortKdes };
    }
  }
}

export const ServerReportViewer: FC = () => {
  const { timestamp } = useParams<{ studyName?: string; timestamp?: string }>();
  const [searchParams] = useSearchParams();
  const urlCohorts = useMemo(
    () => searchParams.get('cohorts')?.split(',').filter(Boolean) ?? [],
    [searchParams],
  );
  const urlCohortsRef = useRef(urlCohorts);
  urlCohortsRef.current = urlCohorts;

  // ── Run selection ─────────────────────────────────────────────────────
  const [selectedRun, setSelectedRun] = useState<string | null>(null);

  // ── Data state ────────────────────────────────────────────────────────
  const [allCohortEntries, setAllCohortEntries] = useState<CohortEntry[]>([]);
  const [allOutcomesEntries, setAllOutcomesEntries] = useState<CohortEntry[]>([]);
  const [waterfallData, setWaterfallData] = useState<Record<string, unknown>>({});
  const [table2Data, setTable2Data] = useState<Record<string, Table2Row[]> | undefined>();
  const [timeToEventData, setTimeToEventData] = useState<Record<string, TimeToEventRow[]> | undefined>();
  const [loadingRun, setLoadingRun] = useState(false);
  const [initialSelections, setInitialSelections] = useState<LegendSelection[] | undefined>();

  // ── Resolve run from URL param or fall back to latest ─────────────────
  useEffect(() => {
    if (timestamp) {
      setSelectedRun(timestamp);
    } else {
      fetchRuns().then((r) => {
        if (r.length) setSelectedRun(r[r.length - 1]);
      });
    }
  }, [timestamp]);

  // ── Build selections from cohort names ────────────────────────────────
  const buildSelections = useCallback(
    (names: string[]): LegendSelection[] => {
      const parsed = parseCohortGroups(names);
      const findInfo = (fullName: string) => {
        for (let gi = 0; gi < parsed.length; gi++) {
          const group = parsed[gi];
          for (let si = 0; si < group.subcohorts.length; si++) {
            if (group.subcohorts[si].fullName === fullName) {
              return { groupIndex: gi, subIndex: si, totalSubs: group.subcohorts.length };
            }
          }
        }
        return { groupIndex: 0, subIndex: 0, totalSubs: 1 };
      };
      const used = new Set<number>();
      return names.map((name) => {
        let ci = 0;
        while (used.has(ci)) ci++;
        used.add(ci);
        return { cohortName: name, colorIndex: ci, ...findInfo(name) };
      });
    },
    [],
  );

  // ── Load run data ─────────────────────────────────────────────────────
  const loadRun = useCallback((runId: string, bypassCache = false) => {
    setLoadingRun(true);

    const cached = bypassCache ? null : getCached(runId);

    if (cached) {
      const cachedT2 = getCachedTable2(runId) ?? undefined;
      const cachedTte = getCachedTimeToEvent(runId) ?? undefined;
      fetchFrozenCohortsCombined(runId).catch(() => []).then(() => {
        applyLoadedData(runId, cached.entries, cached.outcomesEntries, cached.waterfall, cachedT2, cachedTte);
      });
      Promise.all([
        fetchKdeCombined(runId).catch(() => ({})),
        fetchKdeCombined(runId, 'table1_outcomes').catch(() => ({})),
        cachedT2 ? Promise.resolve(cachedT2) : fetchTable2Combined(runId).catch(() => ({})),
        cachedTte ? Promise.resolve(cachedTte) : fetchTimeToEventCombined(runId).catch(() => ({})),
      ]).then(([kdes, outcomesKdes, table2, timeToEvent]) => {
        mergeKdesIntoEntries(cached.entries, kdes as Record<string, Record<string, KdeCurve>>);
        mergeKdesIntoEntries(cached.outcomesEntries, outcomesKdes as Record<string, Record<string, KdeCurve>>);
        setAllCohortEntries([...cached.entries]);
        setAllOutcomesEntries([...cached.outcomesEntries]);
        const t2 = Object.keys(table2 as Record<string, unknown>).length ? table2 as Record<string, Table2Row[]> : undefined;
        const tte = Object.keys(timeToEvent as Record<string, unknown>).length ? timeToEvent as Record<string, TimeToEventRow[]> : undefined;
        if (t2 && !cachedT2) setCachedTable2(runId, t2);
        if (tte && !cachedTte) setCachedTimeToEvent(runId, tte);
        setTable2Data(t2);
        setTimeToEventData(tte);
      });
      return;
    }

    Promise.all([
      fetchCombinedTable1(runId),
      fetchCombinedTable1(runId, 'table1_outcomes').catch(() => []),
      fetchFrozenCohortsCombined(runId),
      fetchRunInfo(runId),
      fetchWaterfallCombined(runId).catch(() => ({})),
      fetchKdeCombined(runId).catch(() => ({})),
      fetchKdeCombined(runId, 'table1_outcomes').catch(() => ({})),
      fetchTable2Combined(runId).catch(() => ({})),
      fetchTimeToEventCombined(runId).catch(() => ({})),
    ])
      .then(([entries, outcomesEntries, _frozenCohorts, _info, waterfall, kdes, outcomesKdes, table2, timeToEvent]) => {
        mergeKdesIntoEntries(entries, kdes as Record<string, Record<string, KdeCurve>>);
        mergeKdesIntoEntries(outcomesEntries, outcomesKdes as Record<string, Record<string, KdeCurve>>);
        const t2 = Object.keys(table2 as Record<string, unknown>).length ? table2 as Record<string, Table2Row[]> : undefined;
        const tte = Object.keys(timeToEvent as Record<string, unknown>).length ? timeToEvent as Record<string, TimeToEventRow[]> : undefined;
        const runData: RunData = {
          entries: entries.map(e => ({ ...e, data: { rows: e.data.rows, sections: e.data.sections } })),
          outcomesEntries: outcomesEntries.map(e => ({ ...e, data: { rows: e.data.rows, sections: e.data.sections } })),
          info: _info,
          waterfall,
        };
        setCache(runId, runData);
        if (t2) setCachedTable2(runId, t2);
        if (tte) setCachedTimeToEvent(runId, tte);
        applyLoadedData(runId, entries, outcomesEntries, waterfall, t2, tte);
      })
      .catch((err) => {
        console.error('[ServerReportViewer] failed to load run data:', err);
        setLoadingRun(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyLoadedData = useCallback(
    (
      runId: string,
      entries: CohortEntry[],
      outcomesEntries: CohortEntry[],
      waterfall: Record<string, unknown>,
      table2?: Record<string, Table2Row[]>,
      timeToEvent?: Record<string, TimeToEventRow[]>,
    ) => {
      const names = entries.map((e) => e.cohortName);
      setAllCohortEntries(entries);
      setAllOutcomesEntries(outcomesEntries);
      setWaterfallData(waterfall);
      setTable2Data(table2);
      setTimeToEventData(timeToEvent);

      // Priority: URL params > saved state > default first cohort
      const cohortParams = urlCohortsRef.current;
      if (cohortParams.length) {
        const available = new Set(names);
        const valid = cohortParams.filter((n) => available.has(n));
        if (valid.length) {
          setInitialSelections(buildSelections(valid));
          setLoadingRun(false);
          return;
        }
      }

      const saved = loadSelections(runId);
      if (saved?.length) {
        const available = new Set(names);
        const valid = saved.filter((s) => available.has(s.cohortName));
        if (valid.length) {
          setInitialSelections(valid);
          setLoadingRun(false);
          return;
        }
      }

      const parsed = parseCohortGroups(names);
      if (parsed.length && parsed[0].subcohorts.length) {
        setInitialSelections(buildSelections([parsed[0].subcohorts[0].fullName]));
      } else {
        setInitialSelections([]);
      }
      setLoadingRun(false);
    },
    [buildSelections],
  );

  useEffect(() => {
    if (selectedRun) loadRun(selectedRun);
  }, [selectedRun, loadRun]);

  // ── AI analysis ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedRun || !allCohortEntries.length) return;
    const names = allCohortEntries.map((e) => e.cohortName);
    fetchReportAnalysis(selectedRun, names).catch(() => {});
  }, [selectedRun, allCohortEntries]);

  // ── Persist selections ────────────────────────────────────────────────
  const handleSelectionsChange = useCallback(
    (sels: LegendSelection[]) => {
      if (selectedRun && sels.length) {
        saveSelections(selectedRun, sels);
      }
    },
    [selectedRun],
  );

  return (
    <ReportViewer
      allCohortEntries={allCohortEntries}
      allOutcomesEntries={allOutcomesEntries}
      waterfallData={waterfallData}
      table2Data={table2Data}
      timeToEventData={timeToEventData}
      runId={selectedRun}
      loading={loadingRun}
      storageKey={selectedRun ? `report-zoom-${selectedRun}` : undefined}
      initialSelections={initialSelections}
      onSelectionsChange={handleSelectionsChange}
    />
  );
};
