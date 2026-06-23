import { FC, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Layout, Model, IJsonModel, Actions, BorderNode, TabSetNode, DockLocation, type Action, type ITabSetRenderValues } from 'flexlayout-react';
import 'flexlayout-react/style/light.css';
import styles from './ReportViewer.module.css';
import { LeftPanel } from './LeftPanel';
import { OutlinePanel } from './OutlinePanel';
import { type Table2Cohort, type TimeToEventCohort } from './GraphsAndTables/OutcomesChart';
import { HorizontalRowViewer } from './HorizontalRowViewer/HorizontalRowViewer';
import { HorizontalRowTitle } from './HorizontalRowViewer/HorizontalRowTitle';
import { CellLayoutStoreProvider } from './CellLayouts';
import { ThreePanelCollapseProvider, useThreePanelCollapse } from '../../contexts/ThreePanelCollapseContext';
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
import { buildSequentialRowList, buildAccordionEntries, keyMatchesRow, sectionKey, categoryKey, type SequentialRow, type StudyRegistry } from './studyRegistryUtils';

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

// ── Layout constants ────────────────────────────────────────────────────

const LEFT_BORDER_SIZE = 300;
const LEFT_BORDER_MIN = 250;

function createLayoutModel(): Model {
  const json: IJsonModel = {
    global: {
      tabEnableClose: false,
      tabEnableRename: false,
      tabEnableDrag: true,
      tabSetEnableMaximize: false,
      tabSetEnableDrop: true,
      borderEnableDrop: true,
    },
    borders: [
      {
        type: 'border',
        location: 'left',
        size: LEFT_BORDER_SIZE,
        minSize: LEFT_BORDER_MIN,
        selected: 0,
        children: [
          { type: 'tab', name: 'Cohorts', component: 'cohortSelector', enableClose: false, enableDrag: true },
          { type: 'tab', name: 'Outline', component: 'outline', enableClose: false, enableDrag: true },
        ],
      },
      {
        type: 'border',
        location: 'right',
        size: 300,
        minSize: 200,
        selected: 0,
        children: [{ type: 'tab', name: 'Interact', component: 'rightStacked', enableClose: false }],
      },
    ],
    layout: {
      type: 'row',
      children: [
        {
          type: 'tabset',
          enableTabStrip: false,
          enableDrop: false,
          children: [{ type: 'tab', name: 'Report', component: 'center', enableClose: false, enableDrag: false }],
        },
      ],
    },
  };
  return Model.fromJson(json);
}

// ── Component ───────────────────────────────────────────────────────────

export const ReportViewer: FC<ReportViewerProps> = (props) => (
  <ThreePanelCollapseProvider storageKey={props.storageKey ? `${props.storageKey}-left-panel` : undefined}>
    <ReportViewerInner {...props} />
  </ThreePanelCollapseProvider>
);

const ReportViewerInner: FC<ReportViewerProps> = ({
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

  // ── Outline accordion + viewer entries ───────────────────────────────
  // `expandedKeys` is the single source of truth shared by the outline and the
  // viewer: it decides which sections are expanded into individual row cells.
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const viewerEntries = useMemo(
    () => buildAccordionEntries(sequentialRows, expandedKeys),
    [sequentialRows, expandedKeys],
  );

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

  // ── HorizontalRowViewer state ─────────────────────────────────────────
  const [viewerIndex, setViewerIndex] = useState(0);
  const [showRowTitle, setShowRowTitle] = useState(false);

  // Expand/collapse a section (or sectionless category) in the outline. This
  // adds/removes its row cells from the viewer. Because the entry list is
  // re-indexed, we re-anchor the viewer onto a stable entry key:
  //  - expanding: stay on the current cell,
  //  - collapsing while viewing one of the removed rows: jump to that section.
  const handleToggleExpand = useCallback((key: string) => {
    const wasExpanded = expandedKeys.has(key);
    const nextExpanded = new Set(expandedKeys);
    if (wasExpanded) nextExpanded.delete(key);
    else nextExpanded.add(key);

    const nextEntries = buildAccordionEntries(sequentialRows, nextExpanded);
    const current = viewerEntries[viewerIndex];
    let targetKey = current?.key;
    if (wasExpanded && current?.kind === 'row' && keyMatchesRow(key, current.row)) {
      targetKey = key;
    }
    const nextIndex = targetKey ? nextEntries.findIndex((e) => e.key === targetKey) : -1;

    setExpandedKeys(nextExpanded);
    setViewerIndex(nextIndex >= 0 ? nextIndex : Math.min(viewerIndex, Math.max(0, nextEntries.length - 1)));
  }, [expandedKeys, sequentialRows, viewerEntries, viewerIndex]);

  // Expand a row's section (if collapsed) and focus that row's individual cell.
  // Used when clicking a row title inside a multi-row section cell.
  const handleNavigateToRow = useCallback((row: SequentialRow) => {
    const key = row.section ? sectionKey(row.category, row.section) : categoryKey(row.category);
    const nextExpanded = new Set(expandedKeys);
    nextExpanded.add(key);
    const nextEntries = buildAccordionEntries(sequentialRows, nextExpanded);
    const idx = nextEntries.findIndex((e) => e.kind === 'row' && e.row.index === row.index);
    setExpandedKeys(nextExpanded);
    if (idx >= 0) setViewerIndex(idx);
  }, [expandedKeys, sequentialRows]);

  // ── FlexLayout + left border collapse ─────────────────────────────────
  const { isLeftPanelShown, setLeftPanelShown, toggleLeftPanel } = useThreePanelCollapse();
  const layoutModelRef = useRef<Model>(createLayoutModel());
  const lastBorderSizeRef = useRef(LEFT_BORDER_SIZE);
  const lastSelectedTabRef = useRef(0);
  const syncingBorderRef = useRef(false);

  const getLeftBorder = useCallback(
    () => layoutModelRef.current.getBorderSet().getBorderMap().get(DockLocation.LEFT),
    [],
  );

  const isBorderOpen = useCallback((border: BorderNode) => border.getSelected() !== -1, []);

  // Sync collapse context → FlexLayout border
  useEffect(() => {
    const border = getLeftBorder();
    if (!border) return;
    const open = isBorderOpen(border);
    if (isLeftPanelShown === open) return;

    syncingBorderRef.current = true;
    if (!isLeftPanelShown) {
      if (border.getSize() > 0) lastBorderSizeRef.current = border.getSize();
      if (border.getSelected() >= 0) lastSelectedTabRef.current = border.getSelected();
      layoutModelRef.current.doAction(Actions.updateNodeAttributes(border.getId(), { selected: -1 }));
    } else {
      layoutModelRef.current.doAction(Actions.updateNodeAttributes(border.getId(), {
        size: lastBorderSizeRef.current,
        selected: lastSelectedTabRef.current,
      }));
    }
    syncingBorderRef.current = false;
  }, [isLeftPanelShown, getLeftBorder, isBorderOpen]);

  const handleLayoutModelChange = useCallback((model: Model, _action: Action) => {
    if (syncingBorderRef.current) return;
    const border = model.getBorderSet().getBorderMap().get(DockLocation.LEFT);
    if (!border) return;

    const open = border.getSelected() !== -1;
    if (open) {
      if (border.getSize() > 0) lastBorderSizeRef.current = border.getSize();
      if (border.getSelected() >= 0) lastSelectedTabRef.current = border.getSelected();
    }

    if (open !== isLeftPanelShown) {
      setLeftPanelShown(open);
    }
  }, [isLeftPanelShown, setLeftPanelShown]);

  const handleRenderTabSet = useCallback((
    node: BorderNode | TabSetNode,
    renderValues: ITabSetRenderValues,
  ) => {
    if (!(node instanceof BorderNode) || node.getLocation() !== DockLocation.LEFT) return;
    renderValues.stickyButtons.push(
      <button
        key="collapse-left"
        type="button"
        className={`${styles.leftBorderCollapseBtn} flexlayout__border_toolbar_button`}
        title={isLeftPanelShown ? 'Collapse panel (⌘B)' : 'Expand panel (⌘B)'}
        onClick={(e) => {
          e.stopPropagation();
          toggleLeftPanel();
        }}
      >
        {isLeftPanelShown ? '◂' : '▸'}
      </button>,
    );
  }, [isLeftPanelShown, toggleLeftPanel]);

  // ⌘B toggles left panel (same as ThreePanelView)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && !e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleLeftPanel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleLeftPanel]);

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

  // ── Nested layout model for right border ──
  const rightPanelModel = useMemo(() => {
    const json: IJsonModel = {
      global: { tabEnableClose: false, tabEnableRename: false, tabEnableDrag: true, tabSetEnableMaximize: true, tabSetEnableDrop: true },
      borders: [],
      layout: {
        type: 'row',
        children: [
          {
            type: 'tabset',
            children: [{ type: 'tab', name: 'AI', component: 'ai' }],
          },
        ],
      },
    };
    return Model.fromJson(json);
  }, []);

  const rightPanelFactory = useCallback(
    (node: { getComponent: () => string | undefined }) => {
      switch (node.getComponent()) {
        case 'ai':
          return <div className={styles.rightPanel} />;
        default:
          return null;
      }
    },
    [],
  );

  const factory = useCallback(
    (node: { getComponent: () => string | undefined }) => {
      switch (node.getComponent()) {
        case 'cohortSelector':
          return (
            <LeftPanel
              groups={groups}
              selections={selections}
              onReplace={handleReplace}
              onAdd={handleAdd}
              onRemove={(index) => updateSelections((prev) => prev.filter((_, i) => i !== index))}
              cohortDescriptions={cohortDescriptions}
              finalCohortSizes={finalCohortSizes}
            />
          );
        case 'outline':
          return (
            <OutlinePanel
              entries={viewerEntries}
              currentIndex={viewerIndex}
              onNavigate={setViewerIndex}
              expandedKeys={expandedKeys}
              onToggleExpand={handleToggleExpand}
            />
          );
        case 'center':
          return (
            <div className={styles.centerPanel}>
              <HorizontalRowViewer
                entries={viewerEntries}
                rows={sequentialRows}
                initialIndex={viewerIndex}
                navigateToIndex={viewerIndex}
                onIndexChange={setViewerIndex}
                onNavigateToRow={handleNavigateToRow}
                onScrolledPastTitle={setShowRowTitle}
                cohortDataMap={cohortDataMap}
                finalCohortSizes={finalCohortSizes}
                tteCohorts={tteCohorts}
                table2Cohorts={table2Cohorts}
                studyTitle={displayTitle}
                studyDescription={studyDescription}
              />
            </div>
          );
        case 'rightStacked':
          return <Layout model={rightPanelModel} factory={rightPanelFactory} />;
        default:
          return null;
      }
    },
    [
      displayTitle, groups, selections, sequentialRows, viewerEntries,
      viewerIndex, expandedKeys, handleToggleExpand, handleNavigateToRow, handleReplace, handleAdd, updateSelections,
      cohortDescriptions, finalCohortSizes, cohortDataMap,
      tteCohorts, table2Cohorts, studyDescription, rightPanelModel, rightPanelFactory,
    ],
  );

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <CellLayoutStoreProvider>
    <div className={styles.container}>
      <div className={styles.titleGroup}>
          <HorizontalRowTitle
            entries={viewerEntries}
            currentIndex={viewerIndex}
            studyTitle={displayTitle}
            onNavigate={setViewerIndex}
          />
      </div>
      <div className={styles.page}>
        <Layout
          model={layoutModelRef.current}
          factory={factory}
          onModelChange={handleLayoutModelChange}
          onRenderTabSet={handleRenderTabSet}
        />
      </div>
    </div>
    </CellLayoutStoreProvider>
  );
};
