import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { ViewerEntry } from '../studyRegistryUtils';




/**
 * Persistent store for section grid layouts.
 *
 * A "section" (identified by a *stable* id, never its display name) can be
 * viewed either as a vertical list (the default) or as one of several named
 * grid layouts. Grid layouts place each row/item on an n-column grid, where
 * every item spans a whole number of columns and rows.
 *
 * Everything is persisted to localStorage and shared process-wide via a
 * singleton store, so both the viewer cells and the outline panel observe the
 * same state without prop drilling.
 */

// ── Types ────────────────────────────────────────────────────────────────

/** Placement of a single item on the section grid (units = grid cells). */
export interface GridItem {
  /** Stable key of the item (row name, or a group id). */
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A group cell: a single grid tile that hosts several member rows stacked
 * inside it. The group is placed on the grid like any other item (its `id` is
 * the {@link GridItem.key}); its members are hidden from the top-level flow and
 * rendered within the group card instead.
 */
export interface CellGroup {
  id: string;
  /** Row keys hosted by this group, in display order. */
  memberKeys: string[];
}

/** A free-form markdown text tile, placed on the grid like any other item. */
export interface TextCell {
  id: string;
  /** Markdown source, rendered in the tile (edited in place). */
  content: string;
}

export interface SectionLayout {
  id: string;
  name: string;
  items: GridItem[];
  /** Keys of items hidden in this grid layout. */
  hiddenKeys?: string[];
  /** Group cells defined in this layout. */
  groups?: CellGroup[];
  /** Free-form markdown text tiles added to this layout. */
  textCells?: TextCell[];
  /** Number of item columns in this grid layout (1–5). */
  columnsPerRow?: number;
  /**
   * Session-only working copy spawned when a (synthetic) default layout is
   * edited. Persisted during the session so the store machinery is reused, but
   * stripped on load so it never survives a reload unless the user saves it.
   */
  draft?: boolean;
}

// ── Synthetic default layouts (one per column count) ─────────────────────

/** Column counts offered as always-available default grid layouts. */
export const DEFAULT_COLUMN_OPTIONS = [1, 2, 3, 4, 5] as const;
const DEFAULT_LAYOUT_PREFIX = '__default_';

/** Id of the synthetic default layout for a given column count. */
export function defaultLayoutId(nCols: number): string {
  return `${DEFAULT_LAYOUT_PREFIX}${nCols}__`;
}

/** True for a synthetic default layout id (never stored in `layouts`). */
export function isDefaultLayoutId(id: string | null): boolean {
  return id != null && id.startsWith(DEFAULT_LAYOUT_PREFIX);
}

/** Column count encoded in a synthetic default layout id. */
export function defaultColumnsFromId(id: string): number {
  return Number(id.slice(DEFAULT_LAYOUT_PREFIX.length, -2)) || 1;
}

/** Human label for a default layout of `nCols` columns. */
export function defaultLayoutName(nCols: number): string {
  return nCols === 1 ? '1 column' : `${nCols} columns`;
}

/** Per-section persisted state. `activeLayoutId === null` ⇒ list view. */
interface SectionState {
  layouts: SectionLayout[];
  activeLayoutId: string | null;
  /** Keys of items hidden while in list view. */
  listHiddenKeys?: string[];
  /** Per-row chart display variant (row key → variant id). */
  displayVariants?: Record<string, string>;
  /** Per-item descriptions shown below the title in locked grid view. */
  descriptions?: Record<string, string>;
}

type PersistedState = Record<string, SectionState>;

// ── Grid constants ───────────────────────────────────────────────────────

export const GRID_COLUMNS = 60;
/** Vertical grid pitch: one cohort-row step (px per grid row). */
export const GRID_ROW_HEIGHT = 12;
/** Horizontal gutter between tiles. */
export const GRID_GAP = 14;
/**
 * Vertical gutter between tiles. Applied as a fixed inset (not per row-track),
 * so it stays a constant visual gap regardless of how many rows a tile spans
 * — kept equal to {@link GRID_GAP} so vertical and horizontal spacing match.
 */
export const GRID_ROW_GAP = 14;

/**
 * Minimum grid-row span for a tile that has no chart (i.e. just title +
 * description). Used as the floor in cohort-delta restacking and as the fixed
 * overhead when sizing group tiles.
 */
export const TILE_HEADER_ROWS = 8;

/** Default grid span (columns) for a new text tile — a third of the canvas. */
export const TEXT_CELL_COLS = 20;
/** Default grid span (rows) for a new text tile. */
export const TEXT_CELL_ROWS = 16;

/** Fixed pixel overhead of a tile's non-chart chrome: header + description + body padding. */
const TILE_CHROME_PX = 60;

// ── Title / description chrome (for content-aware tile heights) ───────────

/** Rendered height (px) of one wrapped line of the bold tile title. */
const TILE_TITLE_LINE_PX = 17;
/** Approx. average glyph width (px) of the title font, for wrap estimation. */
const TILE_TITLE_CHAR_PX = 6.2;
/** Height (px) reserved for the (possibly empty) description line. */
const TILE_DESCRIPTION_PX = 18;
/** Fixed vertical padding (px) of the tile header + body (non-title, non-chart). */
const TILE_PADDING_PX = 22;

// ── Locked-mode chart heights ────────────────────────────────────────────

/** Chart height (px) per cohort for boolean rows (locked view). */
export const PX_PER_COHORT = 12;
/** Fixed overhead (px) added to boolean chart height (header/axis/labels/margins);
 *  matched to the numeric baseline so short barcharts aren't clipped. */
export const BOOLEAN_CHART_OVERHEAD_PX = 120;
/** Extra pixels added to the numeric chart height over the boolean baseline. */
export const NUMERIC_EXTRA_HEIGHT_PX = 120;
/** Fixed chart height (px) for categorical rows (locked mode). */
export const CATEGORICAL_CHART_HEIGHT_PX = 150;

/**
 * Chart height (px) for a locked-mode cell given its row type and cohort count.
 * `spacersPx` is the total pixel height of any spacers interleaved in the bar chart.
 */
export function lockedChartHeight(rowType: string, cohortCount: number, spacersPx = 0): number {
  switch (rowType) {
    case 'categorical': return CATEGORICAL_CHART_HEIGHT_PX;
    case 'numeric': return Math.max(1, cohortCount) * PX_PER_COHORT + NUMERIC_EXTRA_HEIGHT_PX;
    default: return Math.max(1, cohortCount) * PX_PER_COHORT + BOOLEAN_CHART_OVERHEAD_PX + spacersPx;
  }
}

// ── Persistence ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'phenex.sectionLayouts.v2';
const COLUMN_COUNT_KEY = 'phenex.globalColumnCount';

const DEFAULT_COLUMN_COUNT = 3;

function loadGlobalColumnCount(): number {
  try { return Number(localStorage.getItem(COLUMN_COUNT_KEY)) || DEFAULT_COLUMN_COUNT; } catch { return DEFAULT_COLUMN_COUNT; }
}

function saveGlobalColumnCount(n: number) {
  try { localStorage.setItem(COLUMN_COUNT_KEY, String(n)); } catch { /* ignore */ }
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return stripDrafts(parsed as PersistedState);
  } catch {
    return {};
  }
}

/** Drop unsaved draft layouts so they never survive a reload. */
function stripDrafts(state: PersistedState): PersistedState {
  const next: PersistedState = {};
  for (const [id, section] of Object.entries(state)) {
    const draft = section.layouts.find((l) => l.draft);
    if (!draft) { next[id] = section; continue; }
    const layouts = section.layouts.filter((l) => !l.draft);
    const activeLayoutId = section.activeLayoutId === draft.id ? null : section.activeLayoutId;
    next[id] = { ...section, layouts, activeLayoutId };
  }
  return next;
}

function saveState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full / unavailable — ignore */
  }
}

// ── Store ────────────────────────────────────────────────────────────────

type Listener = () => void;

class SectionLayoutStore {
  private state: PersistedState = loadState();
  private listeners = new Set<Listener>();
  /** Cache of empty section states so getSnapshot returns a stable reference. */
  private emptyCache = new Map<string, SectionState>();
  private readonly EMPTY: SectionState = { layouts: [], activeLayoutId: null };
  private _globalColumnCount: number = loadGlobalColumnCount();

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getGlobalColumnCount(): number { return this._globalColumnCount; }

  setGlobalColumnCount(n: number) {
    if (this._globalColumnCount === n) return;
    this._globalColumnCount = n;
    saveGlobalColumnCount(n);
    this.notify();
  }

  getSection(sectionId: string): SectionState {
    return this.state[sectionId] ?? this.emptyFor(sectionId);
  }

  private emptyFor(sectionId: string): SectionState {
    let cached = this.emptyCache.get(sectionId);
    if (!cached) {
      cached = this.EMPTY;
      this.emptyCache.set(sectionId, cached);
    }
    return cached;
  }

  private update(sectionId: string, next: SectionState) {
    this.state = { ...this.state, [sectionId]: next };
    saveState(this.state);
    this.notify();
  }

  setActiveLayout(sectionId: string, layoutId: string | null) {
    const section = this.getSection(sectionId);
    if (section.activeLayoutId === layoutId) return;
    // Switching away from an unsaved draft discards it.
    const draft = section.layouts.find((l) => l.draft);
    const layouts = draft && draft.id !== layoutId
      ? section.layouts.filter((l) => !l.draft)
      : section.layouts;
    this.update(sectionId, { ...section, layouts, activeLayoutId: layoutId });
  }

  createLayout(sectionId: string, name: string, items: GridItem[], columnsPerRow = 5): string {
    const section = this.getSection(sectionId);
    const id = `layout_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const layout: SectionLayout = { id, name, items, columnsPerRow };
    this.update(sectionId, {
      layouts: [...section.layouts, layout],
      activeLayoutId: id,
    });
    return id;
  }

  /**
   * Fork the active (synthetic) default into an editable draft layout carrying
   * `items`. Any prior unsaved draft is replaced. The draft becomes active and
   * shows a "save" prompt; it is stripped on reload unless {@link saveDraft} is
   * called. Returns the new draft id.
   */
  createDraftLayout(sectionId: string, columnsPerRow: number, items: GridItem[]): string {
    const section = this.getSection(sectionId);
    const id = `draft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const savedCount = section.layouts.filter((l) => !l.draft).length;
    const layout: SectionLayout = { id, name: `Layout ${savedCount + 1}`, items, columnsPerRow, draft: true };
    this.update(sectionId, {
      ...section,
      layouts: [...section.layouts.filter((l) => !l.draft), layout],
      activeLayoutId: id,
    });
    return id;
  }

  /** Promote the active draft to a permanent, named layout. */
  saveDraft(sectionId: string, layoutId: string, name: string) {
    const section = this.getSection(sectionId);
    const layouts = section.layouts.map((l) =>
      l.id === layoutId ? { ...l, name: name.trim() || l.name, draft: false } : l,
    );
    this.update(sectionId, { ...section, layouts });
  }

  updateLayoutItems(sectionId: string, layoutId: string, items: GridItem[]) {
    const section = this.getSection(sectionId);
    const layouts = section.layouts.map((l) => (l.id === layoutId ? { ...l, items } : l));
    this.update(sectionId, { ...section, layouts });
  }

  /**
   * Add an empty markdown text tile to a real layout, placed below the current
   * content. The tile lives in `items` (placement) + `textCells` (content), so
   * it moves, resizes and persists exactly like every other grid cell.
   */
  addTextCell(sectionId: string, layoutId: string): string {
    const section = this.getSection(sectionId);
    const id = `text_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const layouts = section.layouts.map((l) => {
      if (l.id !== layoutId) return l;
      const nextY = l.items.reduce((m, it) => Math.max(m, it.y + it.h), 0);
      const item: GridItem = { key: id, x: 0, y: nextY, w: TEXT_CELL_COLS, h: TEXT_CELL_ROWS };
      return { ...l, items: [...l.items, item], textCells: [...(l.textCells ?? []), { id, content: '' }] };
    });
    this.update(sectionId, { ...section, layouts });
    return id;
  }

  updateTextCell(sectionId: string, layoutId: string, id: string, content: string) {
    const section = this.getSection(sectionId);
    const layouts = section.layouts.map((l) =>
      l.id === layoutId
        ? { ...l, textCells: (l.textCells ?? []).map((t) => (t.id === id ? { ...t, content } : t)) }
        : l,
    );
    this.update(sectionId, { ...section, layouts });
  }

  deleteTextCell(sectionId: string, layoutId: string, id: string) {
    const section = this.getSection(sectionId);
    const layouts = section.layouts.map((l) =>
      l.id === layoutId
        ? {
            ...l,
            items: l.items.filter((it) => it.key !== id),
            textCells: (l.textCells ?? []).filter((t) => t.id !== id),
          }
        : l,
    );
    this.update(sectionId, { ...section, layouts });
  }

  renameLayout(sectionId: string, layoutId: string, name: string) {
    const section = this.getSection(sectionId);
    const layouts = section.layouts.map((l) => (l.id === layoutId ? { ...l, name } : l));
    this.update(sectionId, { ...section, layouts });
  }

  toggleItemVisibility(sectionId: string, layoutId: string | null, key: string) {
    const section = this.getSection(sectionId);
    if (layoutId === null) {
      const current = section.listHiddenKeys ?? [];
      const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
      this.update(sectionId, { ...section, listHiddenKeys: next });
    } else {
      const layouts = section.layouts.map((l) => {
        if (l.id !== layoutId) return l;
        const current = l.hiddenKeys ?? [];
        const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
        return { ...l, hiddenKeys: next };
      });
      this.update(sectionId, { ...section, layouts });
    }
  }

  getHiddenKeys(sectionId: string, layoutId: string | null): string[] {
    const section = this.getSection(sectionId);
    if (layoutId === null) return section.listHiddenKeys ?? [];
    return section.layouts.find((l) => l.id === layoutId)?.hiddenKeys ?? [];
  }

  getGroups(sectionId: string, layoutId: string | null): CellGroup[] {
    if (layoutId === null) return [];
    return this.getSection(sectionId).layouts.find((l) => l.id === layoutId)?.groups ?? [];
  }

  /**
   * Bundle `memberKeys` into a new full-width group tile placed below the
   * existing content. The members' own placements are dropped (they now live
   * inside the group). Returns the new group id.
   */
  createGroup(sectionId: string, layoutId: string, memberKeys: string[], height: number): string {
    const section = this.getSection(sectionId);
    const id = `group_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const memberSet = new Set(memberKeys);
    const layouts = section.layouts.map((l) => {
      if (l.id !== layoutId) return l;
      const items = l.items.filter((it) => !memberSet.has(it.key));
      const nextY = items.reduce((m, it) => Math.max(m, it.y + it.h), 0);
      items.push({ key: id, x: 0, y: nextY, w: GRID_COLUMNS, h: Math.max(1, height) });
      return { ...l, items, groups: [...(l.groups ?? []), { id, memberKeys }] };
    });
    this.update(sectionId, { ...section, layouts });
    return id;
  }

  /**
   * Restack the visible items in the active layout to `n` columns.
   * If no layout is active (list/"All" mode), updates the global column count only — no draft is created.
   */
  applyColumnRestack(sectionId: string, n: number, visibleKeys: string[], cohortCount: number) {
    const section = this.getSection(sectionId);
    if (section.activeLayoutId === null) {
      this.setGlobalColumnCount(n);
    } else {
      const items = buildDefaultLayoutItems(visibleKeys, cohortCount, n);
      const layouts = section.layouts.map((l) =>
        l.id === section.activeLayoutId ? { ...l, items, columnsPerRow: n } : l,
      );
      this.update(sectionId, { ...section, layouts });
    }
  }

  /** Dissolve a group; its members flow back into the grid as loose tiles. */
  ungroup(sectionId: string, layoutId: string, groupId: string) {
    const section = this.getSection(sectionId);
    const layouts = section.layouts.map((l) => {
      if (l.id !== layoutId) return l;
      return {
        ...l,
        items: l.items.filter((it) => it.key !== groupId),
        groups: (l.groups ?? []).filter((g) => g.id !== groupId),
      };
    });
    this.update(sectionId, { ...section, layouts });
  }

  getDisplayVariants(sectionId: string): Record<string, string> {
    return this.getSection(sectionId).displayVariants ?? {};
  }

  setDisplayVariant(sectionId: string, rowKey: string, variantId: string) {
    const section = this.getSection(sectionId);
    this.update(sectionId, {
      ...section,
      displayVariants: { ...(section.displayVariants ?? {}), [rowKey]: variantId },
    });
  }

  setItemDescription(sectionId: string, key: string, description: string) {
    const section = this.getSection(sectionId);
    this.update(sectionId, {
      ...section,
      descriptions: { ...(section.descriptions ?? {}), [key]: description },
    });
  }

  deleteLayout(sectionId: string, layoutId: string) {
    const section = this.getSection(sectionId);
    const layouts = section.layouts.filter((l) => l.id !== layoutId);
    const activeLayoutId = section.activeLayoutId === layoutId ? null : section.activeLayoutId;
    this.update(sectionId, { layouts, activeLayoutId });
  }

  exportState(): PersistedState {
    return this.state;
  }

  replaceState(next: PersistedState) {
    this.state = next;
    saveState(next);
    this.notify();
  }

  private notify() {
    for (const l of this.listeners) l();
  }
}

const store = new SectionLayoutStore();

/** Stable empty reference so the hook doesn't churn when no variants are set. */
const EMPTY_VARIANTS: Record<string, string> = {};

/** Stable empty reference so the hook doesn't churn when a layout has no text cells. */
const EMPTY_TEXT_CELLS: TextCell[] = [];
// ── Default layout generation ────────────────────────────────────────────

/**
 * Convert a chart's pixel height to the grid-row span that fits it exactly,
 * accounting for the tile's fixed chrome (header + description + body padding)
 * and the per-tile row-gap inset.
 */
export function tileRowsFromPx(chartHeightPx: number): number {
  return Math.ceil((chartHeightPx + TILE_CHROME_PX + GRID_ROW_GAP) / GRID_ROW_HEIGHT);
}

/** Grid-row span for a fresh boolean tile with `cohortCount` cohorts — matches the locked-mode height. */
export function defaultTileRows(cohortCount: number): number {
  return tileRowsFromPx(lockedChartHeight('boolean', cohortCount));
}

/**
 * Build a default flow-packed grid layout for a set of item keys.
 * `nCols` items per row, each spanning `GRID_COLUMNS / nCols` grid columns.
 */
export function buildDefaultLayoutItems(keys: string[], cohortCount = 1, nCols = 3): GridItem[] {
  const w = Math.floor(GRID_COLUMNS / nCols);
  const h = defaultTileRows(cohortCount);
  return keys.map((key, i) => ({
    key,
    x: (i % nCols) * w,
    y: Math.floor(i / nCols) * h,
    w,
    h,
  }));
}

/**
 * Grid-row span for a tile sized to its actual content: the wrapped title, the
 * description line, and the row-type chart height for `cohortCount` cohorts.
 * `tileWidthPx` is the tile's rendered pixel width (used to estimate how many
 * lines a long title wraps to); pass ≤ 0 when unknown to assume a single line.
 */
export function contentTileRows(
  rowType: string,
  cohortCount: number,
  label: string,
  tileWidthPx: number,
  spacersPx = 0,
): number {
  const charsPerLine = tileWidthPx > 0 ? Math.max(6, Math.floor((tileWidthPx - 20) / TILE_TITLE_CHAR_PX)) : Infinity;
  const titleLines = Math.max(1, Math.ceil((label.length || 1) / charsPerLine));
  const totalPx =
    titleLines * TILE_TITLE_LINE_PX +
    TILE_DESCRIPTION_PX +
    TILE_PADDING_PX +
    lockedChartHeight(rowType, cohortCount, spacersPx);
  return Math.max(TILE_HEADER_ROWS, Math.ceil((totalPx + GRID_ROW_GAP) / GRID_ROW_HEIGHT));
}

/**
 * Flow-pack items of *individual* heights into `nCols` columns, stacking each
 * column independently (round-robin by index) so a tall tile never overlaps or
 * clips its neighbours. Each entry carries its own row span `h`.
 */
export function buildContentLayoutItems(rows: Array<{ key: string; h: number }>, nCols = 3): GridItem[] {
  const w = Math.floor(GRID_COLUMNS / nCols);
  const colY = new Array(nCols).fill(0);
  return rows.map((r, i) => {
    const col = i % nCols;
    const y = colY[col];
    colY[col] += r.h;
    return { key: r.key, x: col * w, y, w, h: r.h };
  });
}

// ── React hook ───────────────────────────────────────────────────────────

export interface UseSectionLayouts {
  layouts: SectionLayout[];
  activeLayoutId: string | null;
  activeLayout: SectionLayout | null;
  /** The globally shared column count applied to all "All" views. */
  globalColumnCount: number;
  /** Hidden item keys for the currently active layout (or list view). */
  hiddenKeys: Set<string>;
  /** Group cells defined in the currently active layout. */
  groups: CellGroup[];
  /** Markdown text tiles in the currently active layout. */
  textCells: TextCell[];
  /** Per-row display variant map (row key → variant id). */
  displayVariants: Record<string, string>;
  /** Per-item descriptions shown below the title in locked grid view. */
  descriptions: Record<string, string>;
  setActiveLayout: (layoutId: string | null) => void;
  createLayout: (name: string, items: GridItem[], columnsPerRow?: number) => string;
  /** Fork the active default into an editable draft carrying `items`. */
  createDraftLayout: (columnsPerRow: number, items: GridItem[]) => string;
  /** Promote the active draft to a permanent named layout. */
  saveDraft: (layoutId: string, name: string) => void;
  updateLayoutItems: (layoutId: string, items: GridItem[]) => void;
  renameLayout: (layoutId: string, name: string) => void;
  deleteLayout: (layoutId: string) => void;
  toggleItemVisibility: (key: string) => void;
  /** Restack visible items to `n` columns; creates a draft when in "All" mode. */
  applyColumnRestack: (n: number, visibleKeys: string[], cohortCount: number) => void;
  createGroup: (memberKeys: string[], height: number) => string;
  ungroup: (groupId: string) => void;
  /** Add an empty markdown text tile to the given layout; returns its id. */
  addTextCell: (layoutId: string) => string;
  updateTextCell: (layoutId: string, id: string, content: string) => void;
  deleteTextCell: (layoutId: string, id: string) => void;
  setDisplayVariant: (rowKey: string, variantId: string) => void;
  setDescription: (key: string, description: string) => void;
}

export function useSectionLayouts(sectionId: string): UseSectionLayouts {
  const section = useSyncExternalStore(
    store.subscribe,
    () => store.getSection(sectionId),
  );

  const setActiveLayout = useCallback((layoutId: string | null) => store.setActiveLayout(sectionId, layoutId), [sectionId]);
  const createLayout = useCallback((name: string, items: GridItem[], columnsPerRow?: number) => store.createLayout(sectionId, name, items, columnsPerRow), [sectionId]);
  const createDraftLayout = useCallback((columnsPerRow: number, items: GridItem[]) => store.createDraftLayout(sectionId, columnsPerRow, items), [sectionId]);
  const saveDraft = useCallback((layoutId: string, name: string) => store.saveDraft(sectionId, layoutId, name), [sectionId]);
  const updateLayoutItems = useCallback((layoutId: string, items: GridItem[]) => store.updateLayoutItems(sectionId, layoutId, items), [sectionId]);
  const renameLayout = useCallback((layoutId: string, name: string) => store.renameLayout(sectionId, layoutId, name), [sectionId]);
  const deleteLayout = useCallback((layoutId: string) => store.deleteLayout(sectionId, layoutId), [sectionId]);
  const toggleItemVisibility = useCallback((key: string) => store.toggleItemVisibility(sectionId, store.getSection(sectionId).activeLayoutId, key), [sectionId]);
  const createGroup = useCallback((memberKeys: string[], height: number) => store.createGroup(sectionId, store.getSection(sectionId).activeLayoutId ?? '', memberKeys, height), [sectionId]);
  const ungroup = useCallback((groupId: string) => store.ungroup(sectionId, store.getSection(sectionId).activeLayoutId ?? '', groupId), [sectionId]);
  const addTextCell = useCallback((layoutId: string) => store.addTextCell(sectionId, layoutId), [sectionId]);
  const updateTextCell = useCallback((layoutId: string, id: string, content: string) => store.updateTextCell(sectionId, layoutId, id, content), [sectionId]);
  const deleteTextCell = useCallback((layoutId: string, id: string) => store.deleteTextCell(sectionId, layoutId, id), [sectionId]);
  const setDisplayVariant = useCallback((rowKey: string, variantId: string) => store.setDisplayVariant(sectionId, rowKey, variantId), [sectionId]);
  const setDescription = useCallback((key: string, description: string) => store.setItemDescription(sectionId, key, description), [sectionId]);
  const applyColumnRestack = useCallback((n: number, visibleKeys: string[], cohortCount: number) => store.applyColumnRestack(sectionId, n, visibleKeys, cohortCount), [sectionId]);

  const activeLayout = section.layouts.find((l) => l.id === section.activeLayoutId) ?? null;
  const hiddenKeys = useMemo(() => new Set(store.getHiddenKeys(sectionId, section.activeLayoutId)), [sectionId, section]);
  const groups = useMemo(() => store.getGroups(sectionId, section.activeLayoutId), [sectionId, section]);
  const textCells = activeLayout?.textCells ?? EMPTY_TEXT_CELLS;
  const displayVariants = section.displayVariants ?? EMPTY_VARIANTS;
  const descriptions = section.descriptions ?? EMPTY_VARIANTS;
  const globalColumnCount = useSyncExternalStore(store.subscribe, () => store.getGlobalColumnCount());

  return {
    layouts: section.layouts,
    activeLayoutId: section.activeLayoutId,
    activeLayout,
    globalColumnCount,
    hiddenKeys,
    groups,
    textCells,
    displayVariants,
    descriptions,
    setActiveLayout,
    createLayout,
    createDraftLayout,
    saveDraft,
    updateLayoutItems,
    renameLayout,
    deleteLayout,
    toggleItemVisibility,
    createGroup,
    ungroup,
    addTextCell,
    updateTextCell,
    deleteTextCell,
    setDisplayVariant,
    setDescription,
    applyColumnRestack,
  };
}

/** Non-hook accessor for imperative reads (e.g. building menus). */
export function getSectionState(sectionId: string): { layouts: SectionLayout[]; activeLayoutId: string | null } {
  return store.getSection(sectionId);
}

/**
 * Derive a *stable* layout id for a section entry. Prefers the outline's
 * persistent `sectionId`; falls back to a category/reporter/section composite
 * (never the mutable display name alone) for non-editable sections.
 */
export function getSectionLayoutId(entry: Extract<ViewerEntry, { kind: 'section' }>): string {
  return entry.sectionId ?? `${entry.category}::${entry.reporter}::${entry.section}`;
}

/** Imperative store handle for menu building outside of React render. */
export const sectionLayoutActions = {
  setActiveLayout: (sectionId: string, layoutId: string | null) => store.setActiveLayout(sectionId, layoutId),
  createLayout: (sectionId: string, name: string, items: GridItem[]) => store.createLayout(sectionId, name, items),
  renameLayout: (sectionId: string, layoutId: string, name: string) => store.renameLayout(sectionId, layoutId, name),
  deleteLayout: (sectionId: string, layoutId: string) => store.deleteLayout(sectionId, layoutId),
  toggleItemVisibility: (sectionId: string, layoutId: string | null, key: string) => store.toggleItemVisibility(sectionId, layoutId, key),
};

/** Return the hidden keys for a given section + layout (or list view). */
export function getHiddenKeys(sectionId: string, layoutId: string | null): string[] {
  return store.getHiddenKeys(sectionId, layoutId);
}

/** Subscribe to store changes (for components that render menus off it). */
export function subscribeSectionLayouts(listener: () => void): () => void {
  return store.subscribe(listener);
}

/** Globally shared column count applied to all "All" views. */
export function getGlobalColumnCount(): number {
  return store.getGlobalColumnCount();
}

/** Snapshot of the entire section-layout store, for export. */
export function exportSectionLayouts(): PersistedState {
  return store.exportState();
}

/** Replace the entire section-layout store with imported data. */
export function importSectionLayouts(state: PersistedState): void {
  store.replaceState(state ?? {});
}
