/**
 * Static (offline) version of the ReportViewer.
 *
 * Reads all data from `window.__REPORT_DATA__` (embedded in the HTML at
 * build time by the Python writer) and renders the full report with no
 * network requests.  Designed to be bundled into a single HTML file via
 * vite-plugin-singlefile.
 */
import { FC, useState, useCallback, useMemo, useRef } from 'react';
import styles from './ReportViewer.module.css';
import { PanZoomScrollbar } from '../../components/CustomScrollbar/PanZoomScrollbar';
import { usePanZoom } from '../../hooks/usePanZoom';
import { CohortSelector } from './CohortSelector';
import { CharacteristicsChart } from './CharacteristicsChart';
import { AttritionChart } from './AttritionChart';
import { ChartGroup } from './ChartGroup';
import { ReportNavPanel } from './ReportViewNavBar/ReportNavPanel';
import { ReportNavPanelCard } from './ReportViewNavBar/ReportNavPanelCard';
import { SectionSelector } from './SectionSelector';
import { ZoomScrubber } from './ReportViewNavBar/ZoomScrubber';
import type { KdeCurve } from './types';
import {
  classifyRows,
  parseCohortGroups,
  getCohortColor,
  type CohortEntry,
  type CohortClassified,
  type CohortGroup,
  type LegendSelection,
} from './types';

// ── Embedded data interface ─────────────────────────────────────────────

interface EmbeddedReportData {
  /** combined_table1.json — { cohortName: { rows, sections } } */
  table1: Record<string, { rows: unknown[]; sections: Record<string, string[]> }>;
  /** combined_table1_outcomes.json (optional) */
  table1_outcomes?: Record<string, { rows: unknown[]; sections: Record<string, string[]> }>;
  /** table1_value_distributions.json — { cohortName: { varName: {x,y} } } */
  kdes?: Record<string, Record<string, KdeCurve>>;
  /** table1_outcomes_value_distributions.json (optional) */
  kdes_outcomes?: Record<string, Record<string, KdeCurve>>;
  /** combined_waterfall.json — { cohortName: waterfallData } */
  waterfall?: Record<string, unknown>;
  /** info.txt key-value pairs */
  info?: Record<string, string>;
  /** Run timestamp string (e.g. "D2026-05-08__T11-49") */
  runId?: string;
}

declare global {
  interface Window {
    __REPORT_DATA__?: EmbeddedReportData;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ordinal = (d: number) => d + (['th', 'st', 'nd', 'rd'][(d % 100 > 10 && d % 100 < 14) ? 0 : d % 10] ?? 'th');

function formatRunTimestamp(raw: string): string {
  const m = raw.match(/D(\d{4})-(\d{2})-(\d{2})__T(\d{2})-(\d{2})/);
  if (!m) return raw;
  const [, year, month, day, hour, minute] = m;
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${ordinal(parseInt(day, 10))} ${year} @${hour}:${minute} CET`;
}

function buildEntries(
  table: Record<string, { rows: unknown[]; sections: Record<string, string[]> }>,
  kdes?: Record<string, Record<string, KdeCurve>>,
): CohortEntry[] {
  return Object.entries(table).map(([cohortName, data]) => ({
    cohortName,
    data: {
      rows: data.rows as CohortEntry['data']['rows'],
      sections: data.sections,
      kdes: kdes?.[cohortName],
    },
  }));
}

// ── Component ───────────────────────────────────────────────────────────

export const StaticReportViewer: FC = () => {
  const reportData = window.__REPORT_DATA__;

  // ── Derive all data synchronously from the embedded payload ───────────
  const allCohortEntries = useMemo(
    () => (reportData?.table1 ? buildEntries(reportData.table1, reportData.kdes) : []),
    [reportData],
  );

  const allOutcomesEntries = useMemo(
    () => (reportData?.table1_outcomes ? buildEntries(reportData.table1_outcomes, reportData.kdes_outcomes) : []),
    [reportData],
  );

  const waterfallData = useMemo(
    () => (reportData?.waterfall ?? {}) as Record<string, unknown>,
    [reportData],
  );

  const runId = reportData?.runId ?? '';

  // ── Cohort groups ─────────────────────────────────────────────────────
  const groups = useMemo(
    () => parseCohortGroups(allCohortEntries.map((e) => e.cohortName)),
    [allCohortEntries],
  );

  // ── Selections ────────────────────────────────────────────────────────
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
    if (!allCohortEntries.length) return [];
    const parsed = parseCohortGroups(allCohortEntries.map((e) => e.cohortName));
    if (parsed.length && parsed[0].subcohorts.length) {
      return buildSelections([parsed[0].subcohorts[0].fullName], parsed);
    }
    return [];
  });

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

  const sections = useMemo(() => {
    for (const entry of cohortEntries) {
      const s = entry.data.sections;
      if (s && Object.keys(s).length) return s;
    }
    return null;
  }, [cohortEntries]);

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

  const outcomesSections = useMemo(() => {
    for (const entry of outcomesEntries) {
      const s = entry.data.sections;
      if (s && Object.keys(s).length) return s;
    }
    return null;
  }, [outcomesEntries]);

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
      setSelections((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], cohortName: fullName, ...info };
        return next;
      });
    },
    [findGroupInfo],
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
      setSelections((prev) => [
        ...prev,
        { cohortName: fullName, colorIndex: nextColorIndex(), ...info },
      ]);
    },
    [nextColorIndex, findGroupInfo],
  );

  // ── View zoom ─────────────────────────────────────────────────────────
  const baselineSectionRefs = useRef(new Map<string, HTMLDivElement>());
  const outcomesSectionRefs = useRef(new Map<string, HTMLDivElement>());

  const pz = usePanZoom({
    minScale: 0.1,
    maxScale: 1.4,
    initialTransform: { x: 0, y: 0, scale: 1 },
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

  // ── Render ────────────────────────────────────────────────────────────
  if (!reportData) {
    return <div style={{ padding: 40, color: '#999' }}>No report data embedded.</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.titleContainer}>
        <span className={styles.title}>PhenEx Report</span>
        <span className={styles.subtitle}>
          {runId ? `Executed ${formatRunTimestamp(runId)}` : ''}
        </span>
      </div>

      <ReportNavPanel
        top={
          <ReportNavPanelCard title="Visible cohorts">
            <CohortSelector
              groups={groups}
              selections={selections}
              onReplace={handleReplace}
              onAdd={handleAdd}
              onRemove={(index) => setSelections((prev) => prev.filter((_, i) => i !== index))}
            />
          </ReportNavPanelCard>
        }
        center={
          <>
            <ReportNavPanelCard title="Outline" background={true}>
              <SectionSelector
                title="Baseline characteristics"
                sections={baselineSectionNames}
                onSelect={(name) => scrollToSection(name, baselineSectionRefs.current)}
              />
              <SectionSelector
                title="Outcomes"
                sections={outcomesSectionNames}
                onSelect={(name) => scrollToSection(name, outcomesSectionRefs.current)}
              />
            </ReportNavPanelCard>
          </>
        }
        bottom={
          <ReportNavPanelCard title="Zoom">
            <ZoomScrubber percentage={pz.zoomPercentage} onChange={pz.setZoomPercentage} />
          </ReportNavPanelCard>
        }
      />

      <div
        className={styles.content}
        ref={pz.viewportRef}
      >
        <div className={styles.bottomGradient} />
        <div className={styles.topGradient} />

        <div className={styles.contentInner} ref={pz.contentRef}>
          {!cohortData.length && (
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

              {outcomesCohortData.length > 0 && (
                <ChartGroup title="Outcomes">
                  <CharacteristicsChart
                    cohortData={outcomesCohortData}
                    sections={outcomesSections}
                    sectionRefs={outcomesSectionRefs.current}
                  />
                </ChartGroup>
              )}

              <div className={styles.bottomSpacer} />
            </>
          )}
        </div>
        <PanZoomScrollbar {...pz.scrollbar} />
      </div>
    </div>
  );
};
