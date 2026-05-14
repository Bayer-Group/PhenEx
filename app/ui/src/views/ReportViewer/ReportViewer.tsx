import { FC, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import styles from './ReportViewer.module.css';
import { PanZoomScrollbar } from '../../components/CustomScrollbar/PanZoomScrollbar';
import { usePanZoom } from '../../hooks/usePanZoom';
import { PanZoomScaleProvider } from '../../hooks/PanZoomScaleContext';
import { CohortSelector } from './ReportFloatingControls/CohortSelector';
import { CharacteristicsChart } from './GraphsAndTables/CharacteristicsChart';
import { Table2Chart, TimeToEventChart, type Table2Cohort, type TimeToEventCohort } from './GraphsAndTables/OutcomesChart';
import { AttritionChart } from './GraphsAndTables/AttritionChart';
import { ChartGroup } from './GraphsAndTables/ChartGroup';
import { ReportNavPanel } from './ReportViewNavBar/ReportNavPanel';
import { ReportNavPanelCard } from './ReportViewNavBar/ReportNavPanelCard';
import { ZoomScrubber } from './ReportViewNavBar/ZoomScrubber';
import { OutlineBar, type OutlineEntry } from './OutlineBar';
import { useVisibleSection } from './useVisibleSection';
import { Portal } from '../../components/Portal/Portal';
import {
  classifyRows,
  parseCohortGroups,
  getCohortColor,
  mergeSections,
  type CohortEntry,
  type CohortClassified,
  type CohortGroup,
  type LegendSelection,
  type Table2Row,
  type TimeToEventRow,
} from './types';
import { buildSequentialRowList, type StudyRegistry } from './studyRegistryUtils';

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
  runId,
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

  const [selections, setSelections] = useState<LegendSelection[]>(() => {
    if (initialSelections?.length) return initialSelections;
    if (!allCohortEntries.length) return [];
    const parsed = parseCohortGroups(allCohortEntries.map((e) => e.cohortName));
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

  const updateSelections = useCallback(
    (updater: LegendSelection[] | ((prev: LegendSelection[]) => LegendSelection[])) => {
      setSelections((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        onSelectionsChange?.(next);
        return next;
      });
    },
    [onSelectionsChange],
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
            ci: sel.colorIndex,
            color: getCohortColor(sel.groupIndex, sel.subIndex, sel.totalSubs),
            classified: classifyRows(entry.data.rows),
            data: entry.data,
          };
        })
        .filter((c): c is CohortClassified => c !== null),
    [cohortEntries, selections],
  );

  const sections = useMemo(() => mergeSections(cohortEntries), [cohortEntries]);

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
            ci: sel.colorIndex,
            color: getCohortColor(sel.groupIndex, sel.subIndex, sel.totalSubs),
            classified: classifyRows(entry.data.rows),
            data: entry.data,
          };
        })
        .filter((c): c is CohortClassified => c !== null),
    [outcomesEntries, selections],
  );

  const outcomesSections = useMemo(() => mergeSections(outcomesEntries), [outcomesEntries]);

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
      updateSelections((prev) => {
        const newSel = { cohortName: fullName, colorIndex: nextColorIndex(), ...info };
        // Insert next to siblings from the same parent group
        const lastSiblingIdx = prev.findLastIndex((s) => s.groupIndex === info.groupIndex);
        if (lastSiblingIdx >= 0) {
          const next = [...prev];
          next.splice(lastSiblingIdx + 1, 0, newSel);
          return next;
        }
        return [...prev, newSel];
      });
    },
    [nextColorIndex, findGroupInfo, updateSelections],
  );

  // ── Pan & zoom ────────────────────────────────────────────────────────
  const INITIAL_X = -100;
  const INITIAL_Y = 0;
  const INITIAL_SCALE = 1;
  const PAN_X_OFFSET = 20;
  const PAN_Y_OFFSET = 100;

  const baselineSectionRefs = useRef(new Map<string, HTMLDivElement>());
  const outcomesSectionRefs = useRef(new Map<string, HTMLDivElement>());
  const attritionRef = useRef<HTMLDivElement>(null);
  const baselineGroupRef = useRef<HTMLDivElement>(null);
  const outcomesGroupRef = useRef<HTMLDivElement>(null);
  const table2GroupRef = useRef<HTMLDivElement>(null);
  const tteGroupRef = useRef<HTMLDivElement>(null);

  const pz = usePanZoom({
    minScale: 0.1,
    maxScale: .7,
    initialTransform: { x: INITIAL_X, y: INITIAL_Y, scale: INITIAL_SCALE },
    storageKey,
    panTargetXOffset: PAN_X_OFFSET,
    panTargetYOffset: PAN_Y_OFFSET,
  });

  const baselineSectionNames = useMemo(() => (sections ? Object.keys(sections) : []), [sections]);
  const outcomesSectionNames = useMemo(() => (outcomesSections ? Object.keys(outcomesSections) : []), [outcomesSections]);

  const scrollToSection = useCallback(
    (name: string, refs: Map<string, HTMLDivElement>) => {
      const el = refs.get(name);
      const contentInner = pz.contentRef.current;
      if (!el || !contentInner) return;
      let top = 0;
      let current: HTMLElement | null = el;
      while (current && current !== contentInner) {
        top += current.offsetTop;
        current = current.offsetParent as HTMLElement | null;
      }
      pz.panToContent(0, top);
    },
    [pz],
  );

  const scrollToElement = useCallback(
    (el: HTMLElement | null) => {
      const contentInner = pz.contentRef.current;
      if (!el || !contentInner) return;
      let top = 0;
      let current: HTMLElement | null = el;
      while (current && current !== contentInner) {
        top += current.offsetTop;
        current = current.offsetParent as HTMLElement | null;
      }
      pz.panToContent(0, top);
    },
    [pz],
  );

  // ── Visible section tracking ──────────────────────────────────────────
  const getVisibleSections = useCallback(() => {
    const entries: { name: string; element: HTMLElement }[] = [];
    if (attritionRef.current) entries.push({ name: 'Attrition', element: attritionRef.current });
    if (baselineGroupRef.current) entries.push({ name: 'Baseline characteristics', element: baselineGroupRef.current });
    for (const [name, el] of baselineSectionRefs.current) {
      entries.push({ name, element: el });
    }
    if (outcomesGroupRef.current) entries.push({ name: 'Outcomes', element: outcomesGroupRef.current });
    for (const [name, el] of outcomesSectionRefs.current) {
      entries.push({ name, element: el });
    }
    if (table2GroupRef.current) entries.push({ name: 'Incidence Rates', element: table2GroupRef.current });
    if (tteGroupRef.current) entries.push({ name: 'Time to Event', element: tteGroupRef.current });
    return entries;
  }, []);

  const activeSection = useVisibleSection(pz.viewportRef, pz.contentRef, getVisibleSections);

  // ── Outline entries ───────────────────────────────────────────────────
  const outlineEntries: OutlineEntry[] = useMemo(() => {
    const entries: OutlineEntry[] = [];
    entries.push({ name: 'Attrition', level: 0, onClick: () => scrollToElement(attritionRef.current) });
    entries.push({ name: 'Baseline characteristics', level: 0, onClick: () => scrollToElement(baselineGroupRef.current) });
    for (const name of baselineSectionNames) {
      entries.push({ name, level: 1, onClick: () => scrollToSection(name, baselineSectionRefs.current) });
    }
    if (outcomesSectionNames.length > 0) {
      entries.push({ name: 'Outcomes', level: 0, onClick: () => scrollToElement(outcomesGroupRef.current) });
      for (const name of outcomesSectionNames) {
        entries.push({ name, level: 1, onClick: () => scrollToSection(name, outcomesSectionRefs.current) });
      }
    }
    if (table2Cohorts.length > 0) {
      entries.push({ name: 'Incidence Rates', level: 0, onClick: () => scrollToElement(table2GroupRef.current) });
    }
    if (tteCohorts.length > 0) {
      entries.push({ name: 'Time to Event', level: 0, onClick: () => scrollToElement(tteGroupRef.current) });
    }
    return entries;
  }, [baselineSectionNames, outcomesSectionNames, table2Cohorts.length, tteCohorts.length, scrollToElement, scrollToSection]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <Portal>
        <div className={styles.titleContainer}>
          <span className={styles.title}>{displayTitle}</span>
          <span className={styles.subtitle}>
            {runId ? `Executed ${formatRunTimestamp(runId)}` : loading ? 'Loading runs...' : ''}
          </span>
        </div>
      </Portal>

      <OutlineBar entries={outlineEntries} activeSection={activeSection} />

      <ReportNavPanel
        bottom={
          <>
            <div style={{ fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <ZoomScrubber percentage={pz.zoomPercentage} onChange={pz.setZoomPercentage} />
            {!pz.isAtHome && (
              <button
                onClick={pz.resetView}
                title="Reset view"
                style={{
                  padding: 4,
                  cursor: 'pointer',
                  border: 'none',
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  opacity: 0.5,
                }}
              >
                reset view
              </button>
            )}
          </div>
          <ReportNavPanelCard title="Visible cohorts" background={true}>
            <CohortSelector
              groups={groups}
              selections={selections}
              onReplace={handleReplace}
              onAdd={handleAdd}
              onRemove={(index) => updateSelections((prev) => prev.filter((_, i) => i !== index))}
            />
          </ReportNavPanelCard>
        </>
        }
      />

      <div className={styles.content} ref={pz.viewportRef}>
        <div className={styles.bottomGradient} />
        <div className={styles.topGradient} />

        <div className={styles.contentInner} ref={pz.contentRef}>
         <PanZoomScaleProvider value={pz.scale}>
          {loading && <div className={styles.loading}>Loading…</div>}

          {!loading && !cohortData.length && (
            <div className={styles.empty}>Select one or more cohorts to view data.</div>
          )}

          {cohortData.length > 0 && (
            <>
              <div ref={attritionRef}>
                <ChartGroup title="Attrition">
                  <AttritionChart cohortData={cohortData} waterfall={waterfallData} />
                </ChartGroup>
              </div>

              <div ref={baselineGroupRef}>
                <ChartGroup title="Baseline Characteristics">
                <CharacteristicsChart
                  cohortData={cohortData}
                  sections={sections}
                  sectionRefs={baselineSectionRefs.current}
                  reporter="table1"
                  sequentialRows={sequentialRows}
                  cohortDataMap={cohortDataMap}
                  studyTitle={displayTitle}
                  onScrollToRow={scrollToElement}
                />
              </ChartGroup>
              </div>

              {outcomesCohortData.length > 0 && (
                <div ref={outcomesGroupRef}>
                  <ChartGroup title="Outcomes">
                    <CharacteristicsChart
                      cohortData={outcomesCohortData}
                      sections={outcomesSections}
                      sectionRefs={outcomesSectionRefs.current}
                      reporter="table1_outcomes"
                      sequentialRows={sequentialRows}
                      cohortDataMap={cohortDataMap}
                      studyTitle={displayTitle}
                      onScrollToRow={scrollToElement}
                    />
                  </ChartGroup>
                </div>
              )}

              {table2Cohorts.length > 0 && (
                <div ref={table2GroupRef}>
                  <ChartGroup title="Incidence Rates">
                    <Table2Chart cohorts={table2Cohorts} />
                  </ChartGroup>
                </div>
              )}

              {tteCohorts.length > 0 && (
                <div ref={tteGroupRef}>
                  <ChartGroup title="Time to Event">
                    <TimeToEventChart cohorts={tteCohorts} />
                  </ChartGroup>
                </div>
              )}

              <div className={styles.bottomSpacer} />
            </>
          )}
         </PanZoomScaleProvider>
        </div>
        <PanZoomScrollbar {...pz.scrollbar} />
      </div>
    </div>
  );
};
