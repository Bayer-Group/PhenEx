import { FC, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import styles from './ReportViewer.module.css';
import { SimpleCustomScrollbar } from '../../components/CustomScrollbar/SimpleCustomScrollbar';
import { useViewZoom } from '../../hooks/useViewZoom';
import { CohortSelector } from './CohortSelector';
import { BooleanChart } from './BooleanChart';
import { CategoricalChart } from './CategoricalChart';
import { NumericChart } from './NumericChart';
import { ReportNavPanel } from './ReportViewNavBar/ReportNavPanel';
import { ReportNavPanelCard } from './ReportViewNavBar/ReportNavPanelCard';
import { ReportDataTypeSelector } from './ReportViewNavBar/ReportDataTypeSelector';
import { ZoomScrubber } from './ReportViewNavBar/ZoomScrubber';
import {
  fetchRuns,
  fetchCombinedTable1,
  fetchFrozenCohortsCombined,
  fetchWaterfallCombined,
  fetchRunInfo,
  fetchReportAnalysis,
} from './ReportViewerDataService';
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

type TabKey = 'boolean' | 'categorical' | 'numeric';

const TAB_ORDER: TabKey[] = ['boolean', 'categorical', 'numeric'];
const PANEL_WIDTH = 900;
const PANEL_GAP = 300;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ordinal = (d: number) => d + (['th', 'st', 'nd', 'rd'][(d % 100 > 10 && d % 100 < 14) ? 0 : d % 10] ?? 'th');

function formatRunTimestamp(raw: string): string {
  const m = raw.match(/D(\d{4})-(\d{2})-(\d{2})__T(\d{2})-(\d{2})/);
  if (!m) return raw;
  const [, year, month, day, hour, minute] = m;
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${ordinal(parseInt(day, 10))} ${year} @${hour}:${minute} CET`;
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
  const [loadingRun, setLoadingRun] = useState(false);

  // ── Tab state ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>('boolean');

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
      console.log(`[ReportViewer] from cache: ${cached.entries.length} cohorts, ${cached.frozenCohorts.length} definitions`);
      applyLoadedData(runId, cached.entries, cached.frozenCohorts, cached.info, cached.waterfall);
      return;
    }

    console.log(`[ReportViewer] fetching run data for: ${runId}`);
    Promise.all([
      fetchCombinedTable1(runId),
      fetchFrozenCohortsCombined(runId),
      fetchRunInfo(runId),
      fetchWaterfallCombined(runId).catch(() => ({})),
    ])
      .then(([entries, frozenCohorts, info, waterfall]) => {
        console.log(`[ReportViewer] loaded ${entries.length} cohorts, ${frozenCohorts.length} frozen definitions, ${Object.keys(waterfall).length} waterfalls, info keys: ${Object.keys(info).join(',')}`);
        const runData: RunData = { entries, frozenCohorts, info, waterfall };
        setCache(runId, runData);
        applyLoadedData(runId, entries, frozenCohorts, info, waterfall);
      })
      .catch((err) => {
        console.error('[ReportViewer] failed to load run data:', err);
        setLoadingRun(false);
      });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  /** Shared logic: set groups, entries, and resolve initial selections. */
  const applyLoadedData = useCallback(
    (runId: string, entries: CohortEntry[], frozenCohorts: Record<string, unknown>[], info: Record<string, string>, waterfall: Record<string, unknown>) => {
      console.log('[ReportViewer] frozen cohort definitions:', frozenCohorts);
      console.log('[ReportViewer] run info:', info);
      console.log('[ReportViewer] waterfall data:', Object.keys(waterfall).length, 'cohorts');

      const names = entries.map((e) => e.cohortName);
      const parsed = parseCohortGroups(names);
      setGroups(parsed);
      setAllCohortEntries(entries);

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

  // ── Determine which tabs have data ────────────────────────────────────
  const tabAvail = useMemo(() => {
    const has = { boolean: false, categorical: false, numeric: false };
    for (const cd of cohortData) {
      if (cd.classified.booleans.length) has.boolean = true;
      if (cd.classified.catOrder.length) has.categorical = true;
      if (cd.classified.numerics.length) has.numeric = true;
    }
    return has;
  }, [cohortData]);

  useEffect(() => {
    if (!tabAvail[activeTab]) {
      const order: TabKey[] = ['boolean', 'categorical', 'numeric'];
      const first = order.find((t) => tabAvail[t]);
      if (first) setActiveTab(first);
    }
  }, [tabAvail, activeTab]);

  // ── Sections from first cohort that has them ──────────────────────────
  const sections = useMemo(() => {
    for (const entry of cohortEntries) {
      const s = entry.data.sections;
      if (s && Object.keys(s).length) return s;
    }
    return null;
  }, [cohortEntries]);

  // ── Render ────────────────────────────────────────────────────────────
  // ── Visibility state ──────────────────────────────────────────────────
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);

  const { viewportRef, transformRef, zoomPercentage, setZoomPercentage, panToX } = useViewZoom({
    minScale: 0.1,
    maxScale: 1.4,
    initialTransform: { x: 0, y: 0, scale: 1 },
    storageKey: selectedRun ? `report-zoom-${selectedRun}` : undefined,
    onTransformChange: (x, _y, scale) => {
      const viewW = contentRef.current?.clientWidth ?? window.innerWidth;
      TAB_ORDER.forEach((_, i) => {
        const panelLeft = i * (PANEL_WIDTH + PANEL_GAP);
        const screenLeft = panelLeft * scale + x;
        const screenRight = (panelLeft + PANEL_WIDTH) * scale + x;
        const visiblePx = Math.max(0, Math.min(screenRight, viewW) - Math.max(screenLeft, 0));
        const visibility = Math.max(0.15, visiblePx / (PANEL_WIDTH * scale));
        panelRefs.current[i]?.style.setProperty('--panel-visibility', String(visibility));
      });
    },
  });

  // ── Pan to active tab's panel on change ───────────────────────────────
  useEffect(() => {
    const i = TAB_ORDER.indexOf(activeTab);
    panToX(i * (PANEL_WIDTH + PANEL_GAP) + PANEL_WIDTH / 2, 0.3);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

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
        bottom={
          <>
            <ReportNavPanelCard title="Zoom">
              <ZoomScrubber percentage={zoomPercentage} onChange={setZoomPercentage} />
            </ReportNavPanelCard>
            <ReportNavPanelCard title="Types">
              <ReportDataTypeSelector
                activeTab={activeTab}
                tabAvail={tabAvail}
                onTabChange={setActiveTab}
                showAnalysis={showAnalysis}
                onShowAnalysisChange={setShowAnalysis}
                showLabels={showLabels}
                onShowLabelsChange={setShowLabels}
              />
            </ReportNavPanelCard>
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
            <div className={styles.chartPanel} ref={el => { panelRefs.current[0] = el; }}>
              <BooleanChart cohortData={cohortData} sections={sections} />
              <div className={styles.bottomSpacer} />
            </div>
            <div className={styles.chartPanel} ref={el => { panelRefs.current[1] = el; }}>
              <CategoricalChart cohortData={cohortData} sections={sections} />
              <div className={styles.bottomSpacer} />
            </div>
            <div className={styles.chartPanel} ref={el => { panelRefs.current[2] = el; }}>
              {selectedRun && (
                <NumericChart
                  cohortData={cohortData}
                  sections={sections}
                  runId={selectedRun}
                  selectedCohorts={selectedCohortNames}
                />
              )}
              <div className={styles.bottomSpacer} />
            </div>
          </>
        )}
        </div>
      </div>
      <SimpleCustomScrollbar targetRef={contentRef} marginToEnd={15} marginBottom={30} marginTop={30}/>
    </div>
  );
};
