import { FC, useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { Layout, Model, IJsonModel, Actions, BorderNode, TabSetNode, TabNode, DockLocation, type Action, type ITabSetRenderValues } from 'flexlayout-react';
import 'flexlayout-react/style/light.css';
import styles from './ReportViewer.module.css';
import { FloatingPanel } from '../../components/FloatingPanel';
import { FullCohortSelector } from './LeftPanels/CohortSelector/FullCohortSelector';
import { FigureLegend } from './LeftPanels/FigureLegend/FigureLegend';
import { OutlinePanel } from './LeftPanels/OutlinePanel/OutlinePanel';
import { type Table2Cohort, type TimeToEventCohort } from './GraphsAndTables/OutcomesChart';
import { HorizontalRowViewer } from './HorizontalRowViewer/HorizontalRowViewer';
import { SingleRowContentHorizontalRowViewer } from './HorizontalRowViewer/SingleRowContentHorizontalRowViewer';
import { BreadcrumbTitle } from './BreadcrumbTitle';
import { CellLayoutStoreProvider } from './CellLayouts';
import { ThreePanelCollapseProvider, useThreePanelCollapse } from '../../contexts/ThreePanelCollapseContext';
import {
  classifyRows,
  parseCohortGroups,
  getSelectionColor,
  type CohortEntry,
  type CohortClassified,
  type CohortGroup,
  type LegendSelection,
  type LegendItem,
  isSpacer,
  type Table2Row,
  type TimeToEventRow,
  type CohortDescriptions,
  type ColorOverrides,
  type Report,
} from './types';
import { type BarChartSpacer } from './GraphsAndTables/RowRenderers/barChartShared';
import { loadSpacers, saveSpacers, loadColorOverrides, saveColorOverrides, type StoredSpacer } from './reportCache';
import { buildSequentialRowList, buildAccordionEntries, type SequentialRow, type ViewerEntry, type StudyRegistry } from './studyRegistryUtils';
import {
  deriveOutlineModel,
  reconcileOutlineModel,
  applyOutlineModel,
  movePhenotype,
  renamePhenotype,
  renameSection,
  type OutlineModel,
} from './LeftPanels/OutlinePanel/outlineModel';

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

/** Stable empty set for building the (never-expanded) main viewer cells. */
const EMPTY_KEYS: Set<string> = new Set();

/** Left-panel component id → floating-window title. */
const LEFT_PANEL_TITLES: Record<string, string> = {
  cohortSelector: 'Cohorts',
  outline: 'Outline',
  figureLegend: 'Legend',
};

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
          { type: 'tab', name: '◧', component: 'leftPanel', enableClose: false, enableDrag: false },
        ],
      },
      {
        type: 'border',
        location: 'right',
        size: 300,
        minSize: 200,
        selected: -1,
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

/** Lightweight store so the OutlinePanel can subscribe to the active cell
 *  without the factory callback needing to be recreated on each navigation.
 *  Identity is by cell `key` so the outline and the (row-free) main viewer can
 *  use independent, differently-indexed entry lists. */
class ActiveKeyStore {
  private _key = '';
  private _listeners = new Set<() => void>();

  set(key: string) {
    if (key === this._key) return;
    this._key = key;
    this._listeners.forEach((l) => l());
  }
  subscribe = (listener: () => void) => {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  };
  getSnapshot = () => this._key;
}

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

  // ── Spacers ───────────────────────────────────────────────────────────
  // Spacers live alongside selections. They are stored positionally by the
  // cohort they follow (`afterCohortName`, null = before first row) so they
  // survive selection changes. The legend manual order is preserved as-is.
  const [spacers, setSpacers] = useState<StoredSpacer[]>(() =>
    _runId ? loadSpacers(_runId) ?? [] : [],
  );

  useEffect(() => {
    if (!_runId) return;
    const loaded = loadSpacers(_runId);
    setSpacers(loaded ?? []);
  }, [_runId]);

  // ── Color overrides ───────────────────────────────────────────────────
  // Per-cohort manual colors keyed by cohort name. Single source of truth
  // shared by the cohort selector, the figure legend, and all charts.
  const [colorOverrides, setColorOverrides] = useState<ColorOverrides>(() =>
    _runId ? loadColorOverrides(_runId) ?? {} : {},
  );

  useEffect(() => {
    if (!_runId) return;
    setColorOverrides(loadColorOverrides(_runId) ?? {});
  }, [_runId]);

  const handleSetColor = useCallback(
    (cohortName: string, color: string) => {
      setColorOverrides((prev) => {
        if (prev[cohortName] === color) return prev;
        const next = { ...prev, [cohortName]: color };
        if (_runId) saveColorOverrides(_runId, next);
        return next;
      });
    },
    [_runId],
  );

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
            displayName: cohortDescriptions?.[entry.cohortName]?.display_name ?? undefined,
            ci: sel.colorIndex,
            color: getSelectionColor(sel, colorOverrides),
            classified: classifyRows(entry.data.rows),
            data: entry.data,
          };
        })
        .filter((c): c is CohortClassified => c !== null),
    [cohortEntries, selections, cohortDescriptions, colorOverrides],
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
            color: getSelectionColor(sel, colorOverrides),
            classified: classifyRows(entry.data.rows),
            data: entry.data,
          };
        })
        .filter((c): c is CohortClassified => c !== null),
    [outcomesEntries, selections, cohortDescriptions, colorOverrides],
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

  // ── Editable outline model ────────────────────────────────────────────
  // A user-editable sections dictionary (drag phenotypes between sections,
  // rename sections/phenotypes) that is the single source of truth for both
  // the outline and the viewer. Stored edits are reconciled against the
  // currently available phenotypes; `null` means "not edited yet".
  const [storedOutline, setStoredOutline] = useState<OutlineModel | null>(null);
  const outlineModel = useMemo(
    () => (storedOutline ? reconcileOutlineModel(storedOutline, sequentialRows) : deriveOutlineModel(sequentialRows)),
    [storedOutline, sequentialRows],
  );
  const effectiveRows = useMemo(
    () => applyOutlineModel(sequentialRows, outlineModel),
    [sequentialRows, outlineModel],
  );

  // ── Outline accordion entries ─────────────────────────────────────────
  // `expandedKeys` drives ONLY the outline's accordion (which sections are
  // expanded into individual phenotype rows). The main viewer no longer shows
  // individual rows, so it is independent of this state.
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const outlineEntries = useMemo(
    () => buildAccordionEntries(effectiveRows, expandedKeys),
    [effectiveRows, expandedKeys],
  );

  // ── Main viewer cells ─────────────────────────────────────────────────
  // The horizontal viewer only ever displays category and (multi-row) section
  // cells — never individual rows. Building with an empty expanded-set yields
  // exactly that, independent of the outline's accordion state.
  const viewerCells = useMemo(
    () => buildAccordionEntries(effectiveRows, EMPTY_KEYS),
    [effectiveRows],
  );

  // Edit operations mutate the stored model, seeding it from the current
  // effective model on first edit.
  const handleMovePhenotype = useCallback((name: string, targetSectionId: string, beforeName: string | null) => {
    setStoredOutline((prev) => movePhenotype(prev ?? outlineModel, name, targetSectionId, beforeName));
  }, [outlineModel]);

  const handleRenamePhenotype = useCallback((name: string, displayName: string) => {
    setStoredOutline((prev) => renamePhenotype(prev ?? outlineModel, name, displayName));
  }, [outlineModel]);

  const handleRenameSection = useCallback((sectionId: string, displayName: string) => {
    setStoredOutline((prev) => renameSection(prev ?? outlineModel, sectionId, displayName));
  }, [outlineModel]);


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
  // Store the active cell KEY so the OutlinePanel can subscribe and highlight
  // its matching entry, regardless of the accordion's (independent) indexing.
  const keyStoreRef = useRef(new ActiveKeyStore());
  useEffect(() => {
    keyStoreRef.current.set(viewerCells[viewerIndex]?.key ?? '');
  }, [viewerIndex, viewerCells]);
  // External navigation: only updated by outline clicks, NOT by the
  // onIndexChange feedback from HorizontalRowViewer itself. This prevents the
  // factory→HorizontalRowViewer→onIndexChange→factory loop.
  const [externalNavIndex, setExternalNavIndex] = useState(0);
  const [showRowTitle, setShowRowTitle] = useState(false);

  // ── Single-row modal ──────────────────────────────────────────────────
  // Clicking an individual phenotype/row (in the outline or inside a section
  // cell) opens a modal that scrolls through that section's rows only.
  const [rowModal, setRowModal] = useState<{ rows: SequentialRow[]; index: number } | null>(null);
  const openRowModal = useCallback((row: SequentialRow) => {
    const sectionRows = effectiveRows.filter(
      (r) => r.category === row.category && r.section === row.section,
    );
    const index = sectionRows.findIndex((r) => r.index === row.index);
    setRowModal({ rows: sectionRows, index: index < 0 ? 0 : index });
  }, [effectiveRows]);
  const closeRowModal = useCallback(() => setRowModal(null), []);

  // Navigate the main viewer to a category/section cell; open the modal for an
  // individual phenotype row. Driven by outline clicks (index into outlineEntries).
  const handleOutlineNavigate = useCallback((outlineIndex: number) => {
    const entry = outlineEntries[outlineIndex];
    if (!entry) return;
    if (entry.kind === 'row') {
      openRowModal(entry.row);
      return;
    }
    const idx = viewerCells.findIndex((c) => c.key === entry.key);
    if (idx >= 0) {
      setViewerIndex(idx);
      setExternalNavIndex(idx);
    }
  }, [outlineEntries, viewerCells, openRowModal]);

  // Navigate the main viewer directly by its own cell index (breadcrumb clicks).
  const handleViewerNavigate = useCallback((index: number) => {
    setViewerIndex(index);
    setExternalNavIndex(index);
  }, []);

  // Toggle a section (or sectionless category) in the outline accordion. This
  // only affects the outline's own entry list; the main viewer is unaffected.
  const handleToggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Clicking a row title inside a multi-row section cell opens the modal.
  const handleNavigateToRow = useCallback((row: SequentialRow) => {
    openRowModal(row);
  }, [openRowModal]);

  // ── FlexLayout + left border collapse ─────────────────────────────────
  const { isLeftPanelShown, setLeftPanelShown, toggleLeftPanel } = useThreePanelCollapse();
  const layoutModelRef = useRef<Model>(createLayoutModel());

  // Stable inner layout for the left panel — supports full drag/drop within the panel
  const leftPanelModelRef = useRef<Model | null>(null);
  if (!leftPanelModelRef.current) {
    leftPanelModelRef.current = Model.fromJson({
      global: {
        tabEnableClose: false,
        tabEnableRename: false,
        tabEnableDrag: true,
        tabSetEnableMaximize: true,
        tabSetEnableDrop: true,
        splitterSize: 4,
      },
      borders: [],
      layout: {
        type: 'row',
        children: [
          {
            type: 'tabset',
            children: [
              { type: 'tab', name: 'Cohorts', component: 'cohortSelector', enableClose: false },
              { type: 'tab', name: 'Outline', component: 'outline', enableClose: false },
              { type: 'tab', name: 'Legend', component: 'figureLegend', enableClose: false },
            ],
          },
        ],
      },
    } as Parameters<typeof Model.fromJson>[0]);
  }

  const lastBorderSizeRef = useRef(LEFT_BORDER_SIZE);
  const lastSelectedTabRef = useRef(0);
  const syncingBorderRef = useRef(false);

  // ── Custom floating popouts (Cohorts / Outline / Legend) ─────────────
  // Instead of FlexLayout's popout (which is bound to its Layout container),
  // a "floated" component is rendered in a FloatingPanel portaled to the body
  // so it can be dragged anywhere in the viewport. The docked slot shows a
  // lightweight placeholder while it is floating.
  const [floatingComponents, setFloatingComponents] = useState<string[]>([]);
  const floatComponent = useCallback((component: string) => {
    setFloatingComponents((prev) => (prev.includes(component) ? prev : [...prev, component]));
  }, []);
  const dockComponent = useCallback((component: string) => {
    setFloatingComponents((prev) => prev.filter((c) => c !== component));
  }, []);

  // Adds a "pop out" button to the active tab of the left panel's tab strip.
  const handleRenderLeftTabSet = useCallback(
    (node: TabSetNode | BorderNode, renderValues: ITabSetRenderValues) => {
      const selected = node.getSelectedNode() as TabNode | undefined;
      const component = selected?.getComponent();
      if (!component || !(component in LEFT_PANEL_TITLES)) return;
      renderValues.stickyButtons.push(
        <button
          key="float"
          className="flexlayout__tab_toolbar_button"
          title="Pop out into floating window"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => floatComponent(component)}
        >
          ⧉
        </button>,
      );
    },
    [floatComponent],
  );

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
          color: getSelectionColor(sel, colorOverrides),
          table2: table2Data?.[sel.cohortName] ?? [],
        }))
        .filter((c) => c.table2.length > 0),
    [selections, table2Data, colorOverrides],
  );

  const tteCohorts: TimeToEventCohort[] = useMemo(
    () =>
      selections
        .map((sel) => ({
          name: sel.cohortName,
          color: getSelectionColor(sel, colorOverrides),
          timeToEvent: timeToEventData?.[sel.cohortName] ?? [],
        }))
        .filter((c) => c.timeToEvent.length > 0),
    [selections, timeToEventData, colorOverrides],
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

  // Combined, ordered legend list (cohorts + spacers) for the FigureLegend.
  // Spacers are placed after the cohort named by `afterCohortName`.
  const legendItems = useMemo<LegendItem[]>(() => {
    const items: LegendItem[] = [];
    const spacerToItem = (s: StoredSpacer): LegendItem => ({ kind: 'spacer', id: s.id, size: s.size, label: s.label });

    const before = spacers.filter((s) => s.afterCohortName === null);
    before.forEach((s) => items.push(spacerToItem(s)));

    for (const sel of selections) {
      items.push(sel);
      spacers
        .filter((s) => s.afterCohortName === sel.cohortName)
        .forEach((s) => items.push(spacerToItem(s)));
    }
    return items;
  }, [selections, spacers]);

  // Bar-chart spacers, positioned by index into the (cohorts-only) display order.
  const barChartSpacers = useMemo<BarChartSpacer[]>(() => {
    const result: BarChartSpacer[] = [];
    let cohortIndex = -1;
    for (const item of legendItems) {
      if (isSpacer(item)) {
        result.push({ afterIndex: cohortIndex, size: item.size, label: item.label });
      } else {
        cohortIndex += 1;
      }
    }
    return result;
  }, [legendItems]);

  const handleLegendChange = useCallback(
    (items: LegendItem[]) => {
      const nextSelections: LegendSelection[] = [];
      const nextSpacers: StoredSpacer[] = [];
      let lastCohortName: string | null = null;

      for (const item of items) {
        if (isSpacer(item)) {
          nextSpacers.push({ id: item.id, size: item.size, afterCohortName: lastCohortName, label: item.label });
        } else {
          nextSelections.push(item);
          lastCohortName = item.cohortName;
        }
      }

      setSpacers(nextSpacers);
      if (_runId) saveSpacers(_runId, nextSpacers);

      setSelections((prev) => {
        const changed =
          prev.length !== nextSelections.length ||
          prev.some((s, i) => s.cohortName !== nextSelections[i].cohortName);
        if (!changed) return prev;
        onSelectionsChange?.(nextSelections);
        return nextSelections;
      });
    },
    [_runId, onSelectionsChange],
  );

  const studyDescription = [
    '<p>This study characterizes baseline demographics, clinical history, and treatment patterns across defined patient cohorts.</p>',
    '<ol>',
    '<li>Select the cohorts you are interested in from the left <strong>Cohorts</strong> tab.</li>',
    '<li>Use the left/right arrows (buttons or keyboard) or the <strong>Outline</strong> tab in the left panel to navigate through the study&rsquo;s sections and view the corresponding data in the main panel.</li>',
    '<li>Use the <strong>Legend</strong> tab in the left panel to customize cohort colors and manage spacers for better visualization.</li>',
    '</ol>',
  ].join('');

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

  // Wrapper that subscribes to the active cell key without factory recreation
  const OutlinePanelConnected = useMemo(() => {
    const store = keyStoreRef.current;
    const Connected: FC<{
      entries: ViewerEntry[];
      onNavigate: (index: number) => void;
      expandedKeys: Set<string>;
      onToggleExpand: (key: string) => void;
      onMovePhenotype: (name: string, targetSectionId: string, beforeName: string | null) => void;
      onRenamePhenotype: (name: string, displayName: string) => void;
      onRenameSection: (sectionId: string, displayName: string) => void;
    }> = ({ entries, onNavigate, expandedKeys: ek, onToggleExpand: ote, onMovePhenotype, onRenamePhenotype, onRenameSection }) => {
      const activeKey = useSyncExternalStore(store.subscribe, store.getSnapshot);
      const currentIndex = entries.findIndex((e) => e.key === activeKey);
      return (
        <OutlinePanel
          entries={entries}
          currentIndex={currentIndex}
          onNavigate={onNavigate}
          expandedKeys={ek}
          onToggleExpand={ote}
          onMovePhenotype={onMovePhenotype}
          onRenamePhenotype={onRenamePhenotype}
          onRenameSection={onRenameSection}
        />
      );
    };
    return Connected;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Renders a single left-panel component (Cohorts / Outline / Legend). Shared
  // by both the docked FlexLayout tab and the floating popout window.
  const renderLeftComponent = useCallback(
    (component: string, isFloating = false) => {
      switch (component) {
        case 'cohortSelector':
          return (
            <FullCohortSelector
              groups={groups}
              selections={selections}
              onReplace={handleReplace}
              onAdd={handleAdd}
              onRemove={(index) => updateSelections((prev) => prev.filter((_, i) => i !== index))}
              cohortDescriptions={cohortDescriptions}
              finalCohortSizes={finalCohortSizes}
              colorOverrides={colorOverrides}
              onSetColor={handleSetColor}
            />
          );
        case 'outline':
          return (
            <OutlinePanelConnected
              entries={outlineEntries}
              onNavigate={handleOutlineNavigate}
              expandedKeys={expandedKeys}
              onToggleExpand={handleToggleExpand}
              onMovePhenotype={handleMovePhenotype}
              onRenamePhenotype={handleRenamePhenotype}
              onRenameSection={handleRenameSection}
            />
          );
        case 'figureLegend':
          return (
            <FigureLegend
              items={legendItems}
              onChange={handleLegendChange}
              cohortDescriptions={cohortDescriptions}
              colorOverrides={colorOverrides}
              onSetColor={handleSetColor}
              isFloating={isFloating}
            />
          );
        default:
          return null;
      }
    },
    [
      groups, selections, handleReplace, handleAdd, updateSelections,
      cohortDescriptions, finalCohortSizes, outlineEntries, handleOutlineNavigate,
      expandedKeys, handleToggleExpand, legendItems, handleLegendChange, OutlinePanelConnected,
      colorOverrides, handleSetColor,
      handleMovePhenotype, handleRenamePhenotype, handleRenameSection,
    ],
  );

  // Factory for the inner left-panel layout. When a component is floating, the
  // docked slot shows a placeholder; otherwise it renders the real content.
  const leftPanelFactory = useCallback(
    (node: { getComponent: () => string | undefined }) => {
      const component = node.getComponent();
      if (!component) return null;
      if (floatingComponents.includes(component)) {
        return (
          <div className={styles.floatingPlaceholder}>
            <span>Currently popped out as a floating panel</span>
            <button type="button" onClick={() => dockComponent(component)}>Click to redock</button>
          </div>
        );
      }
      return renderLeftComponent(component);
    },
    [floatingComponents, renderLeftComponent, dockComponent],
  );
  console.log(" waterfalldata", waterfallData);
  const factory = useCallback(
    (node: { getComponent: () => string | undefined }) => {
      switch (node.getComponent()) {
        case 'leftPanel':
          return (
            <div className={styles.leftPanel}>
              <Layout model={leftPanelModelRef.current!} factory={leftPanelFactory} onRenderTabSet={handleRenderLeftTabSet} />
            </div>
          );
        case 'center':
          return (
            <div className={styles.centerPanel}>
              <HorizontalRowViewer
                entries={viewerCells}
                rows={effectiveRows}
                initialIndex={0}
                navigateToIndex={externalNavIndex}
                onIndexChange={setViewerIndex}
                onNavigateToRow={handleNavigateToRow}
                onScrolledPastTitle={setShowRowTitle}
                cohortDataMap={cohortDataMap}
                finalCohortSizes={finalCohortSizes}
                spacers={barChartSpacers}
                tteCohorts={tteCohorts}
                table2Cohorts={table2Cohorts}
                studyTitle={displayTitle}
                studyDescription={studyDescription}
                waterfallData={waterfallData}
                groups={groups}
                cohortDescriptions={cohortDescriptions}
                colorOverrides={colorOverrides}
                onSetColor={handleSetColor}
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
      displayTitle, effectiveRows, viewerCells, externalNavIndex,
      handleNavigateToRow, handleOutlineNavigate,
      finalCohortSizes, cohortDataMap, barChartSpacers,
      tteCohorts, table2Cohorts, studyDescription, rightPanelModel, rightPanelFactory,
      leftPanelFactory, handleRenderLeftTabSet,
    ],
  );

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <CellLayoutStoreProvider>
    <div className={styles.container}>
      <div className={styles.titleGroup}>
          <BreadcrumbTitle
            entries={viewerCells}
            currentIndex={viewerIndex}
            studyTitle={displayTitle}
            onNavigate={handleViewerNavigate}
          />
      </div>
      <div className={styles.page}>
        <Layout
          model={layoutModelRef.current}
          factory={factory}
          onModelChange={handleLayoutModelChange}
        />
      </div>
      {rowModal && (
        <SingleRowContentHorizontalRowViewer
          rows={rowModal.rows}
          initialIndex={rowModal.index}
          allRows={effectiveRows}
          onClose={closeRowModal}
          cohortDataMap={cohortDataMap}
          finalCohortSizes={finalCohortSizes}
          spacers={barChartSpacers}
          tteCohorts={tteCohorts}
          table2Cohorts={table2Cohorts}
          waterfallData={waterfallData}
          groups={groups}
          cohortDescriptions={cohortDescriptions}
          colorOverrides={colorOverrides}
          onSetColor={handleSetColor}
        />
      )}
      {floatingComponents.map((component, i) => (
        <FloatingPanel
          key={component}
          title={LEFT_PANEL_TITLES[component] ?? component}
          initialX={140 + i * 32}
          initialY={120 + i * 32}
          onClose={() => dockComponent(component)}
        >
          {renderLeftComponent(component, true)}
        </FloatingPanel>
      ))}
    </div>
    </CellLayoutStoreProvider>
  );
};
