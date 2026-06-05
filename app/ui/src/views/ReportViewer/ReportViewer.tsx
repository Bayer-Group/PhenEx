import { FC, useState, useEffect, useCallback, useMemo } from 'react';
import styles from './ReportViewer.module.css';
import { LeftPanel } from './LeftPanel';
import { type Table2Cohort, type TimeToEventCohort } from './GraphsAndTables/OutcomesChart';
import { HorizontalRowViewer } from './HorizontalRowViewer/HorizontalRowViewer';
import { type OutlineEntry } from './OutlineBar';
import { ThreePanelView } from '../MainView/ThreePanelView/ThreePanelView';
import { ThreePanelCollapseProvider } from '../../contexts/ThreePanelCollapseContext';
import { SpatialStudyDisplay } from './SpatialStudyDisplay';
import {
  classifyRows,
  parseCohortGroups,
  getCohortColor,
  type CohortEntry,
  type CohortClassified,
  type CohortGroup,
  type LegendSelection,
  type Table2Row,
  type TimeToEventRow,
  type CohortDescriptions,
  type Report,
} from './types';
import { buildSequentialRowList, getSectionNames, type StudyRegistry } from './studyRegistryUtils';

interface WaterfallInfoRow {
  Name: string;
  Remaining: number | null;
}

interface WaterfallPayload {
  rows: WaterfallInfoRow[];
}

// ── Helpers ─────────────────────────────────────────────────────────────

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ordinal = (d: number) => d + (['th', 'st', 'nd', 'rd'][(d % 100 > 10 && d % 100 < 14) ? 0 : d % 10] ?? 'th');

export function formatRunTimestamp(raw: string): string {
  const m = raw.match(/D(\d{4})-(\d{2})-(\d{2})__T(\d{2})-(\d{2})/);
  if (!m) return raw;
  const [, year, month, day, hour, minute] = m;
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${ordinal(parseInt(day, 10))} ${year} @${hour}:${minute} CET`;
}

// ── Props ───────────────────────────────────────────────────────────────

export interface ReportViewerProps {
  allCohortEntries: CohortEntry[];
  allOutcomesEntries: CohortEntry[];
  waterfallData: Record<string, unknown>;
  table2Data?: Record<string, Table2Row[]>;
  timeToEventData?: Record<string, TimeToEventRow[]>;
  studyRegistry?: StudyRegistry | null;
  cohortDescriptions?: CohortDescriptions;
  reports?: Report[];
  runId: string | null;
  loading?: boolean;
  title?: string;
  storageKey?: string;
  initialSelections?: LegendSelection[];
  onSelectionsChange?: (selections: LegendSelection[]) => void;
}

// ── Component ───────────────────────────────────────────────────────────

export const ReportViewer: FC<ReportViewerProps> = ({
  allCohortEntries,
  allOutcomesEntries,
  waterfallData,
  table2Data,
  timeToEventData,
  studyRegistry,
  cohortDescriptions,
  reports,
  runId: _runId,
  loading = false,
  title = 'Loading study...',
  storageKey,
  initialSelections,
  onSelectionsChange,
}) => {
  const displayTitle = title.split('_').join(' ');

  // ── Cohort groups ─────────────────────────────────────────────────────
  const groups = useMemo(
    () => parseCohortGroups(allCohortEntries.map((e) => e.cohortName)),
    [allCohortEntries],
  );

  // ── Selection helpers ─────────────────────────────────────────────────
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
      return names.map((name) => {
        const info = findInfo(name);
        return { cohortName: name, colorIndex: info.groupIndex, ...info };
      });
    },
    [],
  );

  const [selections, setSelections] = useState<LegendSelection[]>(() => {
    if (initialSelections?.length) return initialSelections;
    if (!allCohortEntries.length) return [];
    const parsed = parseCohortGroups(allCohortEntries.map((e) => e.cohortName));
    const names = allCohortEntries.map((e) => e.cohortName);
    const available = new Set(names);

    // Use initial_load_cohorts from study registry if available
    const initialCohorts = (studyRegistry as Record<string, unknown> | null)?.initial_load_cohorts;
    if (Array.isArray(initialCohorts) && initialCohorts.length) {
      const valid = (initialCohorts as string[]).filter((n) => available.has(n));
      if (valid.length) return buildSelections(valid, parsed);
    }

    if (parsed.length && parsed[0].subcohorts.length) {
      return buildSelections([parsed[0].subcohorts[0].fullName], parsed);
    }
    return [];
  });

  // Sync selections when initialSelections arrives asynchronously (e.g. from server)
  useEffect(() => {
    if (initialSelections?.length) {
      setSelections(initialSelections);
    }
  }, [initialSelections]);

  const sortSelections = useCallback(
    (arr: LegendSelection[]) =>
      [...arr].sort((a, b) => a.groupIndex - b.groupIndex || a.subIndex - b.subIndex),
    [],
  );

  const updateSelections = useCallback(
    (updater: LegendSelection[] | ((prev: LegendSelection[]) => LegendSelection[])) => {
      setSelections((prev) => {
        const raw = typeof updater === 'function' ? updater(prev) : updater;
        const next = sortSelections(raw);
        onSelectionsChange?.(next);
        return next;
      });
    },
    [onSelectionsChange, sortSelections],
  );

  // ── Derived data ──────────────────────────────────────────────────────
  const selectedCohortNames = useMemo(
    () => new Set(selections.map((s) => s.cohortName)),
    [selections],
  );

  const cohortEntries = useMemo(
    () => allCohortEntries.filter((e) => selectedCohortNames.has(e.cohortName)),
    [allCohortEntries, selectedCohortNames],
  );

  const cohortData: CohortClassified[] = useMemo(
    () =>
      selections
        .map((sel) => {
          const entry = cohortEntries.find((e) => e.cohortName === sel.cohortName);
          if (!entry) return null;
          return {
            name: entry.cohortName,
            displayName: cohortDescriptions?.[entry.cohortName]?.display_name ?? undefined,
            ci: sel.colorIndex,
            color: getCohortColor(sel.groupIndex, sel.subIndex, sel.totalSubs),
            classified: classifyRows(entry.data.rows),
            data: entry.data,
          };
        })
        .filter((c): c is CohortClassified => c !== null),
    [cohortEntries, selections, cohortDescriptions],
  );

  // ── Outcomes ──────────────────────────────────────────────────────────
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
            displayName: cohortDescriptions?.[entry.cohortName]?.display_name ?? undefined,
            ci: sel.colorIndex,
            color: getCohortColor(sel.groupIndex, sel.subIndex, sel.totalSubs),
            classified: classifyRows(entry.data.rows),
            data: entry.data,
          };
        })
        .filter((c): c is CohortClassified => c !== null),
    [outcomesEntries, selections, cohortDescriptions],
  );

  // ── Sequential rows (built from selected data so navigable rows = displayed rows)
  const sequentialRows = useMemo(() => {
    const filteredTable2 = table2Data
      ? Object.fromEntries(Object.entries(table2Data).filter(([k]) => selectedCohortNames.has(k)))
      : undefined;
    const filteredTTE = timeToEventData
      ? Object.fromEntries(Object.entries(timeToEventData).filter(([k]) => selectedCohortNames.has(k)))
      : undefined;
    return buildSequentialRowList(
      studyRegistry ?? null,
      cohortEntries,
      outcomesEntries,
      waterfallData,
      Object.keys(filteredTable2 ?? {}).length ? filteredTable2 : undefined,
      Object.keys(filteredTTE ?? {}).length ? filteredTTE : undefined,
    );
  }, [studyRegistry, cohortEntries, outcomesEntries, waterfallData, table2Data, timeToEventData, selectedCohortNames]);

  // Map of reporter → cohort data so HorizontalRowViewer can render any reporter
  const cohortDataMap = useMemo(() => {
    const map: Record<string, typeof cohortData> = { table1: cohortData };
    if (outcomesCohortData.length > 0) map.table1_outcomes = outcomesCohortData;
    return map;
  }, [cohortData, outcomesCohortData]);

  const finalCohortSizes = useMemo(() => {
    return Object.fromEntries(
      Object.entries(waterfallData).map(([cohortName, raw]) => {
        const rows: WaterfallInfoRow[] = Array.isArray(raw) ? raw as WaterfallInfoRow[] : (raw as WaterfallPayload)?.rows ?? [];
        const finalRow = rows.find((row) => row.Name === 'Final Cohort Size');
        return [cohortName, finalRow?.Remaining ?? null];
      }),
    ) as Record<string, number | null>;
  }, [waterfallData]);

  // ── Reporter rows (filtered from sequential rows, one source of truth) ──
  const table1Rows = useMemo(() => sequentialRows.filter((r) => r.reporter === 'table1'), [sequentialRows]);
  const outcomesRows = useMemo(() => sequentialRows.filter((r) => r.reporter === 'table1_outcomes'), [sequentialRows]);
  const table2Rows = useMemo(() => sequentialRows.filter((r) => r.reporter === 'Table2'), [sequentialRows]);
  const tteRows = useMemo(() => sequentialRows.filter((r) => r.reporter === 'TimeToEvent'), [sequentialRows]);

  // ── HorizontalRowViewer state (single instance for all charts) ────────
  const [viewerIndex, setViewerIndex] = useState<number>(-1);
  const closeViewer = useCallback((_finalIndex: number) => {
    setViewerIndex(-1);
  }, []);

  // ── Table2 + TimeToEvent ──────────────────────────────────────────────
  const table2Cohorts: Table2Cohort[] = useMemo(
    () =>
      selections
        .map((sel) => ({
          name: sel.cohortName,
          color: getCohortColor(sel.groupIndex, sel.subIndex, sel.totalSubs),
          table2: table2Data?.[sel.cohortName] ?? [],
        }))
        .filter((c) => c.table2.length > 0),
    [selections, table2Data],
  );

  const tteCohorts: TimeToEventCohort[] = useMemo(
    () =>
      selections
        .map((sel) => ({
          name: sel.cohortName,
          color: getCohortColor(sel.groupIndex, sel.subIndex, sel.totalSubs),
          timeToEvent: timeToEventData?.[sel.cohortName] ?? [],
        }))
        .filter((c) => c.timeToEvent.length > 0),
    [selections, timeToEventData],
  );

  // ── Interaction handlers ──────────────────────────────────────────────
  const findGroupInfo = useCallback(
    (fullName: string) => {
      for (let gi = 0; gi < groups.length; gi++) {
        const group = groups[gi];
        for (let si = 0; si < group.subcohorts.length; si++) {
          if (group.subcohorts[si].fullName === fullName) {
            return { groupIndex: gi, subIndex: si, totalSubs: group.subcohorts.length };
          }
        }
      }
      return { groupIndex: 0, subIndex: 0, totalSubs: 1 };
    },
    [groups],
  );

  const handleReplace = useCallback(
    (index: number, fullName: string) => {
      const info = findGroupInfo(fullName);
      updateSelections((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], cohortName: fullName, ...info };
        return next;
      });
    },
    [findGroupInfo, updateSelections],
  );

  const handleAdd = useCallback(
    (fullName: string) => {
      const info = findGroupInfo(fullName);
      updateSelections((prev) => [
        ...prev,
        { cohortName: fullName, colorIndex: info.groupIndex, ...info },
      ]);
    },
    [findGroupInfo, updateSelections],
  );

  const studyDescription = "This study characterizes baseline demographics, clinical history, and treatment patterns across defined patient cohorts. Outcomes include time-to-event analyses and incidence rates for key clinical endpoints.";

  // ── Outline entries (for LeftPanel) ───────────────────────────────────
  const outlineEntries: OutlineEntry[] = useMemo(() => {
    const entries: OutlineEntry[] = [];
    const baselineSectionNames = getSectionNames(sequentialRows, 'table1');
    const outcomesSectionNames = getSectionNames(sequentialRows, 'table1_outcomes');

    entries.push({ name: 'Attrition', level: 0, onClick: () => {} });
    entries.push({ name: 'Baseline characteristics', level: 0, onClick: () => {} });
    for (const name of baselineSectionNames) {
      entries.push({ name, level: 1, onClick: () => {} });
    }
    if (outcomesSectionNames.length > 0 || table2Rows.length > 0 || tteRows.length > 0) {
      entries.push({ name: 'Outcomes', level: 0, onClick: () => {} });
      for (const name of outcomesSectionNames) {
        entries.push({ name, level: 1, onClick: () => {} });
      }
      if (table2Rows.length > 0) {
        entries.push({ name: 'Incidence Rates', level: 1, onClick: () => {} });
      }
      if (tteRows.length > 0) {
        entries.push({ name: 'Time to Event', level: 1, onClick: () => {} });
      }
    }
    return entries;
  }, [sequentialRows, table2Rows.length, tteRows.length]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <ThreePanelCollapseProvider storageKey="phenex_report_left_shown">
        <ThreePanelView
          split="vertical"
          initalSizeLeft={280}
          initalSizeRight={300}
          minSizeLeft={270}
          minSizeRight={200}
        >
          {/* Left panel: navigation */}
          <LeftPanel
            title={displayTitle}
            groups={groups}
            selections={selections}
            entries={outlineEntries}
            rows={sequentialRows}
            activeSection={null}
            activeRowIndex={viewerIndex}
            onOpenRow={setViewerIndex}
            onReplace={handleReplace}
            onAdd={handleAdd}
            onRemove={(index) => updateSelections((prev) => prev.filter((_, i) => i !== index))}
            cohortDescriptions={cohortDescriptions}
            reports={reports}
            finalCohortSizes={finalCohortSizes}
          />

          {/* Center panel: charts */}
          <div className={styles.centerPanel}>
            <SpatialStudyDisplay
              cohortData={cohortData}
              outcomesCohortData={outcomesCohortData}
              waterfallData={waterfallData}
              sequentialRows={sequentialRows}
              table1Rows={table1Rows}
              outcomesRows={outcomesRows}
              table2Rows={table2Rows}
              tteRows={tteRows}
              table2Cohorts={table2Cohorts}
              tteCohorts={tteCohorts}
              groups={groups}
              cohortDescriptions={cohortDescriptions}
              finalCohortSizes={finalCohortSizes}
              title={displayTitle}
              description={studyDescription}
              loading={loading}
              storageKey={storageKey}
              onOpenRow={setViewerIndex}
            />

            <HorizontalRowViewer
                rows={sequentialRows}
                initialIndex={viewerIndex}
                cohortDataMap={cohortDataMap}
                finalCohortSizes={finalCohortSizes}
                tteCohorts={tteCohorts}
                table2Cohorts={table2Cohorts}
                studyTitle={displayTitle}
                studyDescription={studyDescription}
                onClose={closeViewer}
              />
          </div>

          {/* Right panel: empty for future use */}
          <div className={styles.rightPanel} />
        </ThreePanelView>
      </ThreePanelCollapseProvider>
    </div>
  );
};
