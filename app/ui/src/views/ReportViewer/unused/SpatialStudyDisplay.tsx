import { FC, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import styles from './SpatialStudyDisplay.module.css';
import { PanZoomScrollbar } from '../../../components/CustomScrollbar/PanZoomScrollbar';
import { usePanZoom } from '../../../hooks/usePanZoom';
import { PanZoomScaleProvider } from '../../../hooks/PanZoomScaleContext';
import { CharacteristicsChart } from '../GraphsAndTables/CharacteristicsChart';
import { Table2Chart, TimeToEventChart, type Table2Cohort, type TimeToEventCohort } from '../GraphsAndTables/OutcomesChart';
import { AttritionChart } from '../GraphsAndTables/AttritionChart';
import { ChartGroup } from '../GraphsAndTables/ChartGroup';
import { StudyInfoPanel } from '../GraphsAndTables/StudyInfoPanel';
import { ZoomScrubber } from './ZoomScrubber';
import { type OutlineEntry } from './OutlineBar';
import { useVisibleSection } from '../useVisibleSection';
import { BreadcrumbTitle } from '../BreadcrumbTitle';
import { type CohortClassified, type CohortGroup, type CohortDescriptions } from '../types';
import { type SequentialRow, getSectionNames, buildViewerEntries } from '../studyRegistryUtils';

// ── Props ───────────────────────────────────────────────────────────────

export interface SpatialStudyDisplayProps {
  cohortData: CohortClassified[];
  outcomesCohortData: CohortClassified[];
  waterfallData: Record<string, unknown>;
  sequentialRows: SequentialRow[];
  table1Rows: SequentialRow[];
  outcomesRows: SequentialRow[];
  table2Rows: SequentialRow[];
  tteRows: SequentialRow[];
  table2Cohorts: Table2Cohort[];
  tteCohorts: TimeToEventCohort[];
  groups: CohortGroup[];
  cohortDescriptions?: CohortDescriptions;
  finalCohortSizes?: Record<string, number | null>;
  title: string;
  description: string;
  loading?: boolean;
  storageKey?: string;
  onOpenRow: (index: number) => void;
}

// ── Constants ───────────────────────────────────────────────────────────

const INITIAL_X = -50;
const INITIAL_Y = 0;
const INITIAL_SCALE = 0.1;
const PAN_X_OFFSET = 20;
const PAN_Y_OFFSET = 100;

// ── Component ───────────────────────────────────────────────────────────

export const SpatialStudyDisplay: FC<SpatialStudyDisplayProps> = ({
  cohortData,
  outcomesCohortData,
  waterfallData,
  sequentialRows,
  table1Rows,
  outcomesRows,
  table2Rows,
  tteRows,
  table2Cohorts,
  tteCohorts,
  groups,
  cohortDescriptions,
  finalCohortSizes,
  title,
  description,
  loading = false,
  storageKey,
  onOpenRow,
}) => {
  // ── Section refs ────────────────────────────────────────────────────────
  const baselineSectionRefs = useRef(new Map<string, HTMLDivElement>());
  const outcomesSectionRefs = useRef(new Map<string, HTMLDivElement>());
  const attritionRef = useRef<HTMLDivElement>(null);
  const baselineGroupRef = useRef<HTMLDivElement>(null);
  const outcomesGroupRef = useRef<HTMLDivElement>(null);
  const table2GroupRef = useRef<HTMLDivElement>(null);
  const tteGroupRef = useRef<HTMLDivElement>(null);

  // ── Pan & zoom ────────────────────────────────────────────────────────
  const pz = usePanZoom({
    minScale: 0.1,
    maxScale: 0.3,
    initialTransform: { x: INITIAL_X, y: INITIAL_Y, scale: INITIAL_SCALE },
    storageKey,
    panTargetXOffset: PAN_X_OFFSET,
    panTargetYOffset: PAN_Y_OFFSET,
    lockX: (vpWidth, contentWidth, scale) => {
      const scaledContent = contentWidth * scale;
      if (scaledContent >= vpWidth) return -50;
      return (vpWidth - scaledContent) / 2 - 150;
    },
  });

  // ── Section names ─────────────────────────────────────────────────────
  const baselineSectionNames = useMemo(
    () => getSectionNames(sequentialRows, 'table1'),
    [sequentialRows],
  );
  const outcomesSectionNames = useMemo(
    () => getSectionNames(sequentialRows, 'table1_outcomes'),
    [sequentialRows],
  );

  // ── Scroll helpers ────────────────────────────────────────────────────
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
    if (outcomesSectionNames.length > 0 || table2Rows.length > 0 || tteRows.length > 0) {
      entries.push({ name: 'Outcomes', level: 0, onClick: () => scrollToElement(outcomesGroupRef.current) });
      for (const name of outcomesSectionNames) {
        entries.push({ name, level: 1, onClick: () => scrollToSection(name, outcomesSectionRefs.current) });
      }
      if (table2Rows.length > 0) {
        entries.push({ name: 'Incidence Rates', level: 1, onClick: () => scrollToElement(table2GroupRef.current) });
      }
      if (tteRows.length > 0) {
        entries.push({ name: 'Time to Event', level: 1, onClick: () => scrollToElement(tteGroupRef.current) });
      }
    }
    return entries;
  }, [baselineSectionNames, outcomesSectionNames, table2Rows.length, tteRows.length, scrollToElement, scrollToSection]);

  // ── Active title index ────────────────────────────────────────────────
  const SECTION_TO_CATEGORY: Record<string, string> = {
    'Attrition': 'attrition',
    'Baseline characteristics': 'baseline_characteristics',
    'Outcomes': 'outcomes',
    'Incidence Rates': 'outcomes',
    'Time to Event': 'outcomes',
  };

  const activeTitleIndex = useMemo(() => {
    if (!activeSection || !sequentialRows.length) return 0;
    const bySection = sequentialRows.findIndex((r) => r.section === activeSection);
    if (bySection >= 0) return bySection;
    const catKey = SECTION_TO_CATEGORY[activeSection];
    if (catKey) {
      const byCat = sequentialRows.findIndex((r) => r.category === catKey);
      if (byCat >= 0) return byCat;
    }
    return 0;
  }, [activeSection, sequentialRows]);

  // Map the active sequential-row index to a viewer-entry index for the title.
  const viewerEntries = useMemo(() => buildViewerEntries(sequentialRows), [sequentialRows]);
  const activeEntryIndex = useMemo(() => {
    const idx = viewerEntries.findIndex((e) => e.kind === 'row' && e.row.index === activeTitleIndex);
    return idx >= 0 ? idx : 0;
  }, [viewerEntries, activeTitleIndex]);
  const handleTitleNavigate = useCallback(
    (entryIndex: number) => {
      const e = viewerEntries[entryIndex];
      if (!e) return;
      onOpenRow(e.kind === 'row' ? e.row.index : e.rows[0].index);
    },
    [viewerEntries, onOpenRow],
  );

  // ── Floating title visibility ─────────────────────────────────────────
  const [showFloatingTitle, setShowFloatingTitle] = useState(false);

  useEffect(() => {
    const el = pz.contentRef.current;
    if (!el) return;
    const check = () => {
      const m = el.style.transform.match(/translate\([^,]+,\s*([^)]+)px\)/);
      if (m) setShowFloatingTitle(parseFloat(m[1]) < -100);
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(el, { attributes: true, attributeFilter: ['style'] });
    return () => observer.disconnect();
  }, [pz.contentRef]);

  // ── Scroll-to for close-viewer ────────────────────────────────────────
  // Expose scrollToElement and viewportRef for parent to use on viewer close
  const scrollToRow = useCallback(
    (row: SequentialRow) => {
      const el = document.querySelector(`[data-row-name="${CSS.escape(row.name)}"]`) as HTMLElement | null;
      if (!el) return;
      const vp = pz.viewportRef.current;
      if (vp) {
        const vpRect = vp.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        if (elRect.top >= vpRect.top && elRect.bottom <= vpRect.bottom) return;
      }
      scrollToElement(el);
    },
    [pz.viewportRef, scrollToElement],
  );

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className={styles.container}>
      <div className={`${styles.floatingTitle} ${showFloatingTitle ? styles.floatingTitleVisible : ''}`}>
        <BreadcrumbTitle
          entries={viewerEntries}
          currentIndex={activeEntryIndex}
          studyTitle={title}
          onNavigate={handleTitleNavigate}
        />
      </div>

      <div className={styles.zoomControls}>
        {!pz.isAtHome && (
          <button
            onClick={pz.resetView}
            title="Reset view"
            className={styles.resetViewButton}
          >
            reset view
          </button>
        )}
        <ZoomScrubber percentage={pz.zoomPercentage} onChange={pz.setZoomPercentage} />
      </div>

      <div className={styles.viewport} ref={pz.viewportRef}>
        <div className={styles.topGradient} />

        <div className={styles.contentInner} ref={pz.contentRef}>
          <PanZoomScaleProvider value={pz.scale}>
            {loading && <div className={styles.loading}>Loading…</div>}

            {!loading && !cohortData.length && (
              <div className={styles.empty}>Select one or more cohorts to view data.</div>
            )}

            {cohortData.length > 0 && (
              <>
                <StudyInfoPanel title={title} description={description} />

                <div ref={attritionRef}>
                  <ChartGroup title="Attrition">
                    <AttritionChart
                      cohortData={cohortData}
                      waterfall={waterfallData}
                      groups={groups}
                      cohortDescriptions={cohortDescriptions}
                    />
                  </ChartGroup>
                </div>

                <div ref={baselineGroupRef}>
                  <ChartGroup title="Baseline Characteristics">
                    <CharacteristicsChart
                      cohortData={cohortData}
                      reporterRows={table1Rows}
                      sectionRefs={baselineSectionRefs.current}
                      onOpen={onOpenRow}
                      finalCohortSizes={finalCohortSizes}
                    />
                  </ChartGroup>
                </div>

                {outcomesRows.length > 0 && (
                  <div ref={outcomesGroupRef}>
                    <ChartGroup title="Outcomes">
                      <CharacteristicsChart
                        cohortData={outcomesCohortData}
                        reporterRows={outcomesRows}
                        sectionRefs={outcomesSectionRefs.current}
                        onOpen={onOpenRow}
                        finalCohortSizes={finalCohortSizes}
                      />
                    </ChartGroup>
                  </div>
                )}

                {table2Rows.length > 0 && (
                  <div ref={table2GroupRef}>
                    <ChartGroup title="Incidence Rates">
                      <Table2Chart
                        cohorts={table2Cohorts}
                        reporterRows={table2Rows}
                        onOpen={onOpenRow}
                      />
                    </ChartGroup>
                  </div>
                )}

                {tteRows.length > 0 && (
                  <div ref={tteGroupRef}>
                    <ChartGroup title="Time to Event">
                      <TimeToEventChart
                        cohorts={tteCohorts}
                        reporterRows={tteRows}
                        onOpen={onOpenRow}
                      />
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
