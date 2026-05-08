import { FC, useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import {
  classifyRows,
  parseCohortGroups,
  getCohortColor,
  type CohortEntry,
  type CohortClassified,
  type CohortGroup,
  type LegendSelection,
} from './types';

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
  runId,
  loading = false,
  title = 'LUMINOUS',
  storageKey,
  initialSelections,
  onSelectionsChange,
}) => {
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
      updateSelections((prev) => [
        ...prev,
        { cohortName: fullName, colorIndex: nextColorIndex(), ...info },
      ]);
    },
    [nextColorIndex, findGroupInfo, updateSelections],
  );

  // ── Pan & zoom ────────────────────────────────────────────────────────
  const baselineSectionRefs = useRef(new Map<string, HTMLDivElement>());
  const outcomesSectionRefs = useRef(new Map<string, HTMLDivElement>());

  const pz = usePanZoom({
    minScale: 0.1,
    maxScale: 1.4,
    initialTransform: { x: 0, y: 0, scale: 1 },
    storageKey,
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
  return (
    <div className={styles.page}>
      <div className={styles.titleContainer}>
        <span className={styles.title}>{title}</span>
        <span className={styles.subtitle}>
          {runId ? `Executed ${formatRunTimestamp(runId)}` : loading ? 'Loading runs...' : ''}
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
              onRemove={(index) => updateSelections((prev) => prev.filter((_, i) => i !== index))}
            />
          </ReportNavPanelCard>
        }
        center={
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
        }
        bottom={
          <ZoomScrubber percentage={pz.zoomPercentage} onChange={pz.setZoomPercentage} />
        }
      />

      <div className={styles.content} ref={pz.viewportRef}>
        <div className={styles.bottomGradient} />
        <div className={styles.topGradient} />

        <div className={styles.contentInner} ref={pz.contentRef}>
          {loading && <div className={styles.loading}>Loading…</div>}

          {!loading && !cohortData.length && (
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
