import { FC, useState, useEffect, useCallback, useMemo } from 'react';
import styles from './ReportViewer.module.css';
import { CohortSelector } from './CohortSelector';
import { BooleanChart } from './BooleanChart';
import { CategoricalChart } from './CategoricalChart';
import { NumericChart } from './NumericChart';
import {
  fetchRuns,
  fetchCohorts,
  fetchAllCohortTable1,
  fetchReportAnalysis,
} from './ReportViewerDataService';
import {
  classifyRows,
  parseCohortGroups,
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
        setSelections([{ cohortName: parsed[0].subcohorts[0].fullName, colorIndex: 0 }]);
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

  // ── Replace a legend item ─────────────────────────────────────────────
  const handleReplace = useCallback((index: number, fullName: string) => {
    setSelections((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], cohortName: fullName };
      return next;
    });
  }, []);

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
      setSelections((prev) => [
        ...prev,
        { cohortName: fullName, colorIndex: nextColorIndex() },
      ]);
    },
    [nextColorIndex],
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
  const tabBtnClass = (tab: TabKey) => {
    const classes = [styles.tabBtn];
    if (tab === activeTab) classes.push(styles.tabBtnActive);
    if (!tabAvail[tab]) classes.push(styles.tabBtnDisabled);
    return classes.join(' ');
  };

  const handleTabClick = (tab: TabKey) => {
    if (tabAvail[tab]) setActiveTab(tab);
  };

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

      <div className={styles.tabBar}>
        <button
          className={tabBtnClass('boolean')}
          onClick={() => handleTabClick('boolean')}
        >
          Boolean
        </button>
        <button
          className={tabBtnClass('categorical')}
          onClick={() => handleTabClick('categorical')}
        >
          Categorical
        </button>
        <button
          className={tabBtnClass('numeric')}
          onClick={() => handleTabClick('numeric')}
        >
          Numeric
        </button>
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
