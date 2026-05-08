import { FC, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import styles from './ReportViewer.module.css';
import { SimpleCustomScrollbar } from '../../components/CustomScrollbar/SimpleCustomScrollbar';
import { useViewZoom } from '../../hooks/useViewZoom';
import { CohortSelector } from './CohortSelector';
import { CharacteristicsChart } from './CharacteristicsChart';
import { AttritionChart } from './AttritionChart';
import { ChartGroup } from './ChartGroup';
import { ReportNavPanel } from './ReportViewNavBar/ReportNavPanel';
import { ReportNavPanelCard } from './ReportViewNavBar/ReportNavPanelCard';
import { SectionSelector } from './SectionSelector';
import { ZoomScrubber } from './ReportViewNavBar/ZoomScrubber';
import {
  fetchRuns,
  fetchCombinedTable1,
  fetchFrozenCohortsCombined,
  fetchWaterfallCombined,
  fetchRunInfo,
  fetchReportAnalysis,
  fetchKdeCombined,
} from './ReportViewerDataService';
import type { KdeCurve } from './types';
import { getCached, setCache, clearCache, saveSelections, loadSelections, type RunData } from './reportCache';
import {
  classifyRows,
  parseCohortGroups,
  getCohortColor,
  type CohortEntry,
  type CohortClassified,
  type CohortGroup,
  type LegendSelection,
} from './types';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ordinal = (d: number) => d + (['th', 'st', 'nd', 'rd'][(d % 100 > 10 && d % 100 < 14) ? 0 : d % 10] ?? 'th');

function formatRunTimestamp(raw: string): string {
  const m = raw.match(/D(\d{4})-(\d{2})-(\d{2})__T(\d{2})-(\d{2})/);
  if (!m) return raw;
  const [, year, month, day, hour, minute] = m;
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${ordinal(parseInt(day, 10))} ${year} @${hour}:${minute} CET`;
}

/** Merge combined KDE data into each cohort entry's `kdes` field. */
function mergeKdesIntoEntries(
  entries: CohortEntry[],
  kdes: Record<string, Record<string, KdeCurve>>,
): void {
  let merged = 0;
  for (const entry of entries) {
    const cohortKdes = kdes[entry.cohortName];
    if (cohortKdes) {
      entry.data = { ...entry.data, kdes: cohortKdes };
      merged++;
    }
  }
  console.log(`[mergeKdes] merged KDEs into ${merged}/${entries.length} entries`);
}

export const ReportViewer: FC = () => {
  const { timestamp } = useParams<{ studyName?: string; timestamp?: string }>();
  const [searchParams] = useSearchParams();
  const urlCohorts = useMemo(
    () => searchParams.get('cohorts')?.split(',').filter(Boolean) ?? [],
    [searchParams],
  );
  const urlCohortsRef = useRef(urlCohorts);
  urlCohortsRef.current = urlCohorts;

  // ── Run & cohort selection state ──────────────────────────────────────
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [groups, setGroups] = useState<CohortGroup[]>([]);
  const [selections, setSelections] = useState<LegendSelection[]>([]);

  // ── Data state ────────────────────────────────────────────────────────
  const [allCohortEntries, setAllCohortEntries] = useState<CohortEntry[]>([]);
  const [allOutcomesEntries, setAllOutcomesEntries] = useState<CohortEntry[]>([]);
  const [waterfallData, setWaterfallData] = useState<Record<string, unknown>>({});
  const [loadingRun, setLoadingRun] = useState(false);

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

  // ── Build selections from cohort names using group info ────────────────
  const buildSelections = useCallback(
    (names: string[], parsed: CohortGroup[]): LegendSelection[] => {
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

  // ── Load cohorts + combined data when run changes ──────────────────────
  const loadRun = useCallback((runId: string, bypassCache = false) => {
    setLoadingRun(true);

    const cached = bypassCache ? null : getCached(runId);
    console.debug(`[ReportViewer] loadRun ${runId} — cache ${cached ? 'HIT' : 'MISS'}`);

    if (cached) {
      console.log(`[ReportViewer] from cache: ${cached.entries.length} cohorts`);
      // Frozen cohorts not cached (too large) — fetch separately
      const frozenPromise = fetchFrozenCohortsCombined(runId).catch(() => []);
      frozenPromise.then((frozenCohorts) => {
        applyLoadedData(runId, cached.entries, cached.outcomesEntries, frozenCohorts, cached.info, cached.waterfall);
      });
      // KDEs are not cached (too large) — fetch them separately
      Promise.all([
        fetchKdeCombined(runId).catch(() => ({})),
        fetchKdeCombined(runId, 'table1_outcomes').catch(() => ({})),
      ]).then(([kdes, outcomesKdes]) => {
        mergeKdesIntoEntries(cached.entries, kdes);
        mergeKdesIntoEntries(cached.outcomesEntries, outcomesKdes);
        setAllCohortEntries([...cached.entries]);
        setAllOutcomesEntries([...cached.outcomesEntries]);
      });
      return;
    }

    console.log(`[ReportViewer] fetching run data for: ${runId}`);
    Promise.all([
      fetchCombinedTable1(runId),
      fetchCombinedTable1(runId, 'table1_outcomes').catch(() => []),
      fetchFrozenCohortsCombined(runId),
      fetchRunInfo(runId),
      fetchWaterfallCombined(runId).catch(() => ({})),
      fetchKdeCombined(runId).catch(() => ({})),
      fetchKdeCombined(runId, 'table1_outcomes').catch(() => ({})),
    ])
      .then(([entries, outcomesEntries, frozenCohorts, info, waterfall, kdes, outcomesKdes]) => {
        console.log(`[ReportViewer] loaded ${entries.length} cohorts, ${outcomesEntries.length} outcomes, ${frozenCohorts.length} frozen definitions, ${Object.keys(waterfall).length} waterfalls, ${Object.keys(kdes).length} kdes`);
        mergeKdesIntoEntries(entries, kdes as Record<string, Record<string, KdeCurve>>);
        mergeKdesIntoEntries(outcomesEntries, outcomesKdes as Record<string, Record<string, KdeCurve>>);
        // Cache without KDEs (too large for localStorage)
        const runData: RunData = { entries: entries.map(e => ({...e, data: {rows: e.data.rows, sections: e.data.sections}})), outcomesEntries: outcomesEntries.map(e => ({...e, data: {rows: e.data.rows, sections: e.data.sections}})), info, waterfall };
        setCache(runId, runData);
        applyLoadedData(runId, entries, outcomesEntries, frozenCohorts, info, waterfall);
      })
      .catch((err) => {
        console.error('[ReportViewer] failed to load run data:', err);
        setLoadingRun(false);
      });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  /** Shared logic: set groups, entries, and resolve initial selections. */
  const applyLoadedData = useCallback(
    (runId: string, entries: CohortEntry[], outcomesEntries: CohortEntry[], frozenCohorts: Record<string, unknown>[], info: Record<string, string>, waterfall: Record<string, unknown>) => {
      console.log('[ReportViewer] frozen cohort definitions:', frozenCohorts);
      console.log('[ReportViewer] run info:', info);
      console.log('[ReportViewer] waterfall data:', Object.keys(waterfall).length, 'cohorts');

      const names = entries.map((e) => e.cohortName);
      const parsed = parseCohortGroups(names);
      setGroups(parsed);
      setAllCohortEntries(entries);
      setAllOutcomesEntries(outcomesEntries);
      setWaterfallData(waterfall);

      // Priority: URL params > saved state > default first cohort
      const cohortParams = urlCohortsRef.current;

      if (cohortParams.length) {
        const available = new Set(names);
        const valid = cohortParams.filter((n) => available.has(n));
        if (valid.length) {
          setSelections(buildSelections(valid, parsed));
          setLoadingRun(false);
          return;
        }
      }

      const saved = loadSelections(runId);
      if (saved?.length) {
        const available = new Set(names);
        const valid = saved.filter((s) => available.has(s.cohortName));
        if (valid.length) {
          setSelections(valid);
          setLoadingRun(false);
          return;
        }
      }

      if (parsed.length && parsed[0].subcohorts.length) {
        setSelections(buildSelections([parsed[0].subcohorts[0].fullName], parsed));
      } else {
        setSelections([]);
      }
      setLoadingRun(false);
    },
    [buildSelections],
  );

  useEffect(() => {
    if (selectedRun) loadRun(selectedRun);
  }, [selectedRun, loadRun]);

  /** Re-fetch from the server, ignoring the cache. */
  const refreshData = useCallback(() => {
    if (!selectedRun) return;
    clearCache(selectedRun);
    loadRun(selectedRun, true);
  }, [selectedRun, loadRun]);

  /** Delete cached data for the current run. */
  const deleteCache = useCallback(() => {
    if (selectedRun) clearCache(selectedRun);
  }, [selectedRun]);

  // ── Persist selections to localStorage on change ──────────────────────
  useEffect(() => {
    if (selectedRun && selections.length) {
      saveSelections(selectedRun, selections);
    }
  }, [selectedRun, selections]);

  // ── Derive visible cohort entries from selections (instant, no fetch) ─
  const selectedCohortNames = useMemo(
    () => new Set(selections.map((s) => s.cohortName)),
    [selections],
  );

  const cohortEntries = useMemo(
    () => allCohortEntries.filter((e) => selectedCohortNames.has(e.cohortName)),
    [allCohortEntries, selectedCohortNames],
  );

  // ── AI analysis on data load ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedRun || !cohortEntries.length) return;
    const names = cohortEntries.map((e) => e.cohortName);
    fetchReportAnalysis(selectedRun, names).then((result) => {
      console.log('AI Report Analysis:', result);
    }).catch((err) => {
      console.warn('AI analysis failed:', err);
    });
  }, [selectedRun, cohortEntries]);

  // ── Helper: find group/sub indices for a cohort name ────────────────
  const findGroupInfo = useCallback((fullName: string) => {
    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      for (let si = 0; si < group.subcohorts.length; si++) {
        if (group.subcohorts[si].fullName === fullName) {
          return { groupIndex: gi, subIndex: si, totalSubs: group.subcohorts.length };
        }
      }
    }
    return { groupIndex: 0, subIndex: 0, totalSubs: 1 };
  }, [groups]);

  // ── Replace a legend item ─────────────────────────────────────────────
  const handleReplace = useCallback((index: number, fullName: string) => {
    const info = findGroupInfo(fullName);
    setSelections((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], cohortName: fullName, ...info };
      return next;
    });
  }, [findGroupInfo]);

  // ── Add a new legend item ─────────────────────────────────────────────
  const nextColorIndex = useCallback(() => {
    const used = new Set(selections.map((s) => s.colorIndex));
    for (let i = 0; i < 10; i++) {
      if (!used.has(i)) return i;
    }
    return selections.length;
  }, [selections]);

  const handleAdd = useCallback(
    (fullName: string) => {
      const info = findGroupInfo(fullName);
      setSelections((prev) => [
        ...prev,
        { cohortName: fullName, colorIndex: nextColorIndex(), ...info },
      ]);
    },
    [nextColorIndex, findGroupInfo],
  );

  // ── Classify rows for selected cohorts ────────────────────────────────
  const cohortData: CohortClassified[] = useMemo(
    () =>
      selections
        .map((sel) => {
          const entry = cohortEntries.find((e) => e.cohortName === sel.cohortName);
          if (!entry) return null;
          return {
            name: entry.cohortName,
            ci: sel.colorIndex,
            color: getCohortColor(sel.groupIndex, sel.subIndex, sel.totalSubs),
            classified: classifyRows(entry.data.rows),
            data: entry.data,
          };
        })
        .filter((c): c is CohortClassified => c !== null),
    [cohortEntries, selections],
  );

  // ── Sections from first cohort that has them ──────────────────────────
  const sections = useMemo(() => {
    for (const entry of cohortEntries) {
      const s = entry.data.sections;
      if (s && Object.keys(s).length) return s;
    }
    return null;
  }, [cohortEntries]);

  // ── Outcomes: filter + classify selected cohorts ──────────────────────
  const outcomesEntries = useMemo(
    () => allOutcomesEntries.filter((e) => selectedCohortNames.has(e.cohortName)),
    [allOutcomesEntries, selectedCohortNames],
  );

  const outcomesCohortData: CohortClassified[] = useMemo(
    () =>
      selections
        .map((sel) => {
          const entry = outcomesEntries.find((e) => e.cohortName === sel.cohortName);
          if (!entry) return null;
          return {
            name: entry.cohortName,
            ci: sel.colorIndex,
            color: getCohortColor(sel.groupIndex, sel.subIndex, sel.totalSubs),
            classified: classifyRows(entry.data.rows),
            data: entry.data,
          };
        })
        .filter((c): c is CohortClassified => c !== null),
    [outcomesEntries, selections],
  );

  const outcomesSections = useMemo(() => {
    for (const entry of outcomesEntries) {
      const s = entry.data.sections;
      if (s && Object.keys(s).length) return s;
    }
    return null;
  }, [outcomesEntries]);

  // ── Render ────────────────────────────────────────────────────────────
  const contentRef = useRef<HTMLDivElement>(null);
  const baselineSectionRefs = useRef(new Map<string, HTMLDivElement>());
  const outcomesSectionRefs = useRef(new Map<string, HTMLDivElement>());

  const { viewportRef, transformRef, zoomPercentage, setZoomPercentage, panTo } = useViewZoom({
    minScale: 0.1,
    maxScale: 1.4,
    initialTransform: { x: 0, y: 0, scale: 1 },
    storageKey: selectedRun ? `report-zoom-${selectedRun}` : undefined,
  });

  const baselineSectionNames = useMemo(
    () => (sections ? Object.keys(sections) : []),
    [sections],
  );
  const outcomesSectionNames = useMemo(
    () => (outcomesSections ? Object.keys(outcomesSections) : []),
    [outcomesSections],
  );

  const scrollToSection = useCallback(
    (name: string, refs: Map<string, HTMLDivElement>) => {
      const el = refs.get(name);
      const contentInner = transformRef.current;
      if (!el || !contentInner) return;
      let top = 0;
      let current: HTMLElement | null = el;
      while (current && current !== contentInner) {
        top += current.offsetTop;
        current = current.offsetParent as HTMLElement | null;
      }
      panTo(0, top);
    },
    [panTo, transformRef],
  );

  return (
    <div className={styles.page}>
      <div className={styles.titleContainer}>
        <span className={styles.title}>LUMINOUS</span>
        <span className={styles.subtitle}>Executed {selectedRun ? formatRunTimestamp(selectedRun) : 'Loading runs...'}</span>
      </div>

      <ReportNavPanel
        top={
          <div style={{ height: 100 }} />
        }
        top = {
          <>
          <ReportNavPanelCard title="Visible cohorts">
              <CohortSelector
                groups={groups}
                selections={selections}
                onReplace={handleReplace}
                onAdd={handleAdd}
                onRemove={(index) => setSelections((prev) => prev.filter((_, i) => i !== index))}
              />
            </ReportNavPanelCard>
          </>
        }
        center = {
          <>
            <ReportNavPanelCard title="Baseline characteristics">
              <SectionSelector
                sections={baselineSectionNames}
                onSelect={(name) => scrollToSection(name, baselineSectionRefs.current)}
              />
            </ReportNavPanelCard>
            <ReportNavPanelCard title="Outcomes">
              <SectionSelector
                sections={outcomesSectionNames}
                onSelect={(name) => scrollToSection(name, outcomesSectionRefs.current)}
              />
            </ReportNavPanelCard>
          </>
        }
        bottom={
          <>
            <ReportNavPanelCard title="Zoom">
              <ZoomScrubber percentage={zoomPercentage} onChange={setZoomPercentage} />
            </ReportNavPanelCard>
          </>
        }
      />

      <div className={styles.content} ref={(el) => {
        (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        (viewportRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      }}>
              <div className={styles.bottomGradient} />
              <div className={styles.topGradient} />

        <div className={styles.contentInner} ref={transformRef}>

        {loadingRun && <div className={styles.loading}>Loading…</div>}

        {!loadingRun && !cohortData.length && (
          <div className={styles.empty}>Select one or more cohorts to view data.</div>
        )}

        {cohortData.length > 0 && (
          <>
            <ChartGroup title="Attrition">
              <AttritionChart cohortData={cohortData} waterfall={waterfallData} />
            </ChartGroup>

            <ChartGroup title="Baseline Characteristics">
              <CharacteristicsChart
                cohortData={cohortData}
                sections={sections}
                sectionRefs={baselineSectionRefs.current}
              />
            </ChartGroup>

            <ChartGroup title="Outcomes">
              <CharacteristicsChart
                cohortData={outcomesCohortData}
                sections={outcomesSections}
                sectionRefs={outcomesSectionRefs.current}
              />
            </ChartGroup>

            <div className={styles.bottomSpacer} />
          </>
        )}
        </div>
      </div>
      <SimpleCustomScrollbar targetRef={contentRef} marginToEnd={15} marginBottom={30} marginTop={30}/>
    </div>
  );
};
