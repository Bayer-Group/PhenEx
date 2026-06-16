import { FC, useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  fetchAllCohortTable1,
  fetchReportAnalysis,
} from './ReportViewerDataService';
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
  // ── Run & cohort selection state ──────────────────────────────────────
  const [runs, setRuns] = useState<string[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [groups, setGroups] = useState<CohortGroup[]>([]);
  const [selections, setSelections] = useState<LegendSelection[]>([]);

  // ── Data state ────────────────────────────────────────────────────────
  const [cohortEntries, setCohortEntries] = useState<CohortEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Tab state ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>('boolean');

  // ── Load runs on mount ────────────────────────────────────────────────
  useEffect(() => {
    fetchRuns().then((r) => {
      setRuns(r);
      if (r.length) setSelectedRun(r[r.length - 1]);
    });
  }, []);

  // ── Load cohorts when run changes ─────────────────────────────────────
  useEffect(() => {
    if (!selectedRun) return;
    fetchCohorts(selectedRun).then((names) => {
      const parsed = parseCohortGroups(names);
      setGroups(parsed);
      // Default: select first parent cohort's "main"
      if (parsed.length && parsed[0].subcohorts.length) {
        setSelections([{
          cohortName: parsed[0].subcohorts[0].fullName,
          colorIndex: 0,
          groupIndex: 0,
          subIndex: 0,
          totalSubs: parsed[0].subcohorts.length,
        }]);
      } else {
        setSelections([]);
      }
    });
  }, [selectedRun]);

  // ── Load table1 data when selection changes ───────────────────────────
  const selectedCohortNames = useMemo(
    () => new Set(selections.map((s) => s.cohortName)),
    [selections],
  );

  useEffect(() => {
    if (!selectedRun || !selections.length) {
      setCohortEntries([]);
      return;
    }
    setLoading(true);
    fetchAllCohortTable1(selectedRun, selections.map((s) => s.cohortName)).then(
      (entries) => {
        setCohortEntries(entries);
        setLoading(false);
      },
    );
  }, [selectedRun, selections]);

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
        <div className={styles.runSelector}>
          <label>Run:</label>
          <select
            value={selectedRun ?? ''}
            onChange={(e) => setSelectedRun(e.target.value)}
          >
            {runs.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <CohortSelector
          groups={groups}
          selections={selections}
          onReplace={handleReplace}
          onAdd={handleAdd}
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

        {loading && <div className={styles.loading}>Loading…</div>}

        {!loading && !cohortData.length && (
          <div className={styles.empty}>Select one or more cohorts to view data.</div>
        )}

        {!loading && cohortData.length > 0 && (
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
          </>
        )}
      </div>
    </div>
  );
};
