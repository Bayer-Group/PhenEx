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
} from './ReportViewerDataService';
import {
  classifyRows,
  type CohortEntry,
  type CohortClassified,
} from './types';

type TabKey = 'boolean' | 'categorical' | 'numeric';

export const ReportViewer: FC = () => {
  // ── Run & cohort selection state ──────────────────────────────────────
  const [runs, setRuns] = useState<string[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [cohortNames, setCohortNames] = useState<string[]>([]);
  const [selectedCohorts, setSelectedCohorts] = useState<Set<string>>(new Set());

  // ── Data state ────────────────────────────────────────────────────────
  const [cohortEntries, setCohortEntries] = useState<CohortEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Tab state ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>('boolean');

  // ── Load runs on mount ────────────────────────────────────────────────
  useEffect(() => {
    fetchRuns().then((r) => {
      setRuns(r);
      if (r.length) setSelectedRun(r[r.length - 1]); // default to latest
    });
  }, []);

  // ── Load cohorts when run changes ─────────────────────────────────────
  useEffect(() => {
    if (!selectedRun) return;
    fetchCohorts(selectedRun).then((names) => {
      setCohortNames(names);
      setSelectedCohorts(new Set(names.length ? [names[0]] : []));
    });
  }, [selectedRun]);

  // ── Load table1 data when selection changes ───────────────────────────
  useEffect(() => {
    if (!selectedRun || !selectedCohorts.size) {
      setCohortEntries([]);
      return;
    }
    setLoading(true);
    fetchAllCohortTable1(selectedRun, Array.from(selectedCohorts)).then((entries) => {
      setCohortEntries(entries);
      setLoading(false);
    });
  }, [selectedRun, selectedCohorts]);

  // ── Toggle cohort selection ───────────────────────────────────────────
  const toggleCohort = useCallback((name: string) => {
    setSelectedCohorts((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  // ── Classify rows for selected cohorts ────────────────────────────────
  const cohortData: CohortClassified[] = useMemo(
    () =>
      cohortEntries.map((entry) => ({
        name: entry.cohortName,
        ci: cohortNames.indexOf(entry.cohortName),
        classified: classifyRows(entry.data.rows),
        data: entry.data,
      })),
    [cohortEntries, cohortNames],
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

  // Ensure active tab is valid
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
      <div className={styles.header}>
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
          cohortNames={cohortNames}
          selected={selectedCohorts}
          onToggle={toggleCohort}
        />

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
      </div>

      <div className={styles.content}>
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
                selectedCohorts={selectedCohorts}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};
