import { FC, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import styles from './ReportViewer.module.css';
import navBarStyles from '../../components/PhenExNavBar/NavBar.module.css';
import { CohortSelector } from './CohortSelector';
import { BooleanChart } from './BooleanChart';
import { CategoricalChart } from './CategoricalChart';
import { NumericChart } from './NumericChart';
import { Tabs } from '../../components/ButtonsAndTabs/Tabs/Tabs';
import { PhenExNavBarMenu } from '../../components/PhenExNavBar/PhenExNavBarMenu';
import { SwitchButton } from '../../components/ButtonsAndTabs/SwitchButton/SwitchButton';
import {
  fetchRuns,
  fetchCohorts,
  fetchCombinedTable1,
  fetchReportAnalysis,
} from './ReportViewerDataService';
import { getCached, setCache, clearCache, saveSelections, loadSelections } from './reportCache';
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
      // Fully offline path — derive cohort names from cached entries
      const names = cached.map((e) => e.cohortName);
      applyLoadedData(runId, names, cached);
      return;
    }

    Promise.all([fetchCohorts(runId), fetchCombinedTable1(runId)]).then(
      ([names, entries]) => {
        setCache(runId, entries);
        applyLoadedData(runId, names, entries);
      },
    );
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  /** Shared logic: set groups, entries, and resolve initial selections. */
  const applyLoadedData = useCallback(
    (runId: string, names: string[], entries: CohortEntry[]) => {
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
  const TAB_KEYS: TabKey[] = ['boolean', 'categorical', 'numeric'];
  const TAB_LABELS = ['Boolean', 'Categorical', 'Numeric'];

  const handleTabChange = (index: number) => {
    const key = TAB_KEYS[index];
    if (tabAvail[key]) setActiveTab(key);
  };

  // ── Visibility menu state ─────────────────────────────────────────────
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [isVisMenuOpen, setIsVisMenuOpen] = useState(false);
  const eyeBtnRef = useRef<HTMLButtonElement>(null);
  const visMenuRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;

  return (
    <div className={styles.page}>
      <div className={styles.legendContainer}>
        <h1 className={styles.title}>Baseline Characteristics</h1>
        <CohortSelector
          groups={groups}
          selections={selections}
          onReplace={handleReplace}
          onAdd={handleAdd}
          onRemove={(index) => setSelections((prev) => prev.filter((_, i) => i !== index))}
        />
      </div>

      <div className={styles.navBarContainer}>
        <div className={navBarStyles.navBar} style={{ height: 44 }}>
          <div className={navBarStyles.viewNavContent}>
            <Tabs
              tabs={TAB_LABELS}
              active_tab_index={TAB_KEYS.indexOf(activeTab)}
              onTabChange={handleTabChange}
              classNameTabs={navBarStyles.classNameSectionTabs}
              classNameTabsContainer={navBarStyles.classNameTabsContainer}
              classNameActiveTab={navBarStyles.classNameActiveTab}
              classNameHoverTab={navBarStyles.classNameHoverTab}
            />
            <button
              ref={eyeBtnRef}
              className={navBarStyles.eyeButton}
              onMouseEnter={() => setIsVisMenuOpen(true)}
              onMouseLeave={() => {
                setTimeout(() => {
                  if (!visMenuRef.current?.matches(':hover')) {
                    setIsVisMenuOpen(false);
                  }
                }, 100);
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>

        <PhenExNavBarMenu
          isOpen={isVisMenuOpen}
          onClose={() => setIsVisMenuOpen(false)}
          anchorElement={eyeBtnRef.current}
          menuRef={visMenuRef}
          onMouseEnter={() => setIsVisMenuOpen(true)}
          onMouseLeave={() => setIsVisMenuOpen(false)}
          verticalPosition="above"
          horizontalAlignment="center"
        >
          <div style={{ padding: '12px', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>Visibility Options</div>
            <SwitchButton
              label="Show Analysis"
              value={showAnalysis}
              onValueChange={setShowAnalysis}
            />
            <SwitchButton
              label="Show Labels"
              value={showLabels}
              onValueChange={setShowLabels}
            />
          </div>
        </PhenExNavBarMenu>
      </div>

      <div className={styles.content}>
              <div className={styles.bottomGradient} />
              <div className={styles.topGradient} />

        {loadingRun && <div className={styles.loading}>Loading…</div>}

        {!loadingRun && !cohortData.length && (
          <div className={styles.empty}>Select one or more cohorts to view data.</div>
        )}

        {cohortData.length > 0 && (
          <>
            {activeTab === 'boolean' && (
              <BooleanChart cohortData={cohortData} sections={sections} />
            )}
            {activeTab === 'categorical' && (
              <CategoricalChart cohortData={cohortData} sections={sections} />
            )}
            {activeTab === 'numeric' && selectedRun && (
              <NumericChart
                cohortData={cohortData}
                sections={sections}
                runId={selectedRun}
                selectedCohorts={selectedCohortNames}
              />
            )}

            <div className={styles.bottomSpacer} />
          </>

        )}
      </div>
    </div>
  );
};
