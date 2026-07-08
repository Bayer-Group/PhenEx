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

export interface SectionLayout {
  id: string;
  name: string;
  items: GridItem[];
  /** Keys of items hidden in this grid layout. */
  hiddenKeys?: string[];
  /** Group cells defined in this layout. */
  groups?: CellGroup[];
}

/** Per-section persisted state. `activeLayoutId === null` ⇒ list view. */
interface SectionState {
  layouts: SectionLayout[];
  activeLayoutId: string | null;
  /** Keys of items hidden while in list view. */
  listHiddenKeys?: string[];
  /** Per-row chart display variant (row key → variant id). */
  displayVariants?: Record<string, string>;
}

type PersistedState = Record<string, SectionState>;

// ── Grid constants ───────────────────────────────────────────────────────

export const GRID_COLUMNS = 10;
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
 * A fresh grid tile reserves a fixed `TILE_HEADER_ROWS` block for the title /
 * chrome / bottom padding, plus `ROWS_PER_COHORT` grid rows for **each** cohort
 * it must show. Adding one cohort therefore grows the tile by `ROWS_PER_COHORT`
 * rows (≈ `ROWS_PER_COHORT` × `GRID_ROW_HEIGHT`px). Bump `ROWS_PER_COHORT` to give
 * each cohort more vertical space; bump `TILE_HEADER_ROWS` for a taller fixed header.
 */
export const TILE_HEADER_ROWS = 8;
/** Grid rows allotted per cohort in a tile's body. */
export const ROWS_PER_COHORT = 1;

// ── Persistence ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'phenex.sectionLayouts.v1';

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as PersistedState) : {};
  } catch {
    return {};
  }
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

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

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
    this.update(sectionId, { ...section, activeLayoutId: layoutId });
  }

  createLayout(sectionId: string, name: string, items: GridItem[]): string {
    const section = this.getSection(sectionId);
    const id = `layout_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const layout: SectionLayout = { id, name, items };
    this.update(sectionId, {
      layouts: [...section.layouts, layout],
      activeLayoutId: id,
    });
    return id;
  }

  updateLayoutItems(sectionId: string, layoutId: string, items: GridItem[]) {
    const section = this.getSection(sectionId);
    const layouts = section.layouts.map((l) => (l.id === layoutId ? { ...l, items } : l));
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

// ── Default layout generation ────────────────────────────────────────────

/**
 * Grid-row span for a fresh tile given how many cohorts it must show: a fixed
 * header block plus `ROWS_PER_COHORT` rows per cohort, so each cohort added
 * grows the tile by `ROWS_PER_COHORT` rows.
 */
export function defaultTileRows(cohortCount: number): number {
  return TILE_HEADER_ROWS + Math.max(1, cohortCount) * ROWS_PER_COHORT;
}

/**
 * Build a default flow-packed grid layout for a set of item keys: each item is
 * a 2-column tile whose height scales with `cohortCount`, laid left-to-right
 * and wrapping to the next band.
 */
export function buildDefaultLayoutItems(keys: string[], cohortCount = 1): GridItem[] {
  const w = 2;
  const h = defaultTileRows(cohortCount);
  const perRow = Math.max(1, Math.floor(GRID_COLUMNS / w));
  return keys.map((key, i) => ({
    key,
    x: (i % perRow) * w,
    y: Math.floor(i / perRow) * h,
    w,
    h,
  }));
}

// ── React hook ───────────────────────────────────────────────────────────

export interface UseSectionLayouts {
  layouts: SectionLayout[];
  activeLayoutId: string | null;
  activeLayout: SectionLayout | null;
  /** Hidden item keys for the currently active layout (or list view). */
  hiddenKeys: Set<string>;
  /** Group cells defined in the currently active layout. */
  groups: CellGroup[];
  /** Per-row display variant map (row key → variant id). */
  displayVariants: Record<string, string>;
  setActiveLayout: (layoutId: string | null) => void;
  createLayout: (name: string, items: GridItem[]) => string;
  updateLayoutItems: (layoutId: string, items: GridItem[]) => void;
  renameLayout: (layoutId: string, name: string) => void;
  deleteLayout: (layoutId: string) => void;
  toggleItemVisibility: (key: string) => void;
  createGroup: (memberKeys: string[], height: number) => string;
  ungroup: (groupId: string) => void;
  setDisplayVariant: (rowKey: string, variantId: string) => void;
}

export function useSectionLayouts(sectionId: string): UseSectionLayouts {
  const section = useSyncExternalStore(
    store.subscribe,
    () => store.getSection(sectionId),
  );

  const setActiveLayout = useCallback((layoutId: string | null) => store.setActiveLayout(sectionId, layoutId), [sectionId]);
  const createLayout = useCallback((name: string, items: GridItem[]) => store.createLayout(sectionId, name, items), [sectionId]);
  const updateLayoutItems = useCallback((layoutId: string, items: GridItem[]) => store.updateLayoutItems(sectionId, layoutId, items), [sectionId]);
  const renameLayout = useCallback((layoutId: string, name: string) => store.renameLayout(sectionId, layoutId, name), [sectionId]);
  const deleteLayout = useCallback((layoutId: string) => store.deleteLayout(sectionId, layoutId), [sectionId]);
  const toggleItemVisibility = useCallback((key: string) => store.toggleItemVisibility(sectionId, store.getSection(sectionId).activeLayoutId, key), [sectionId]);
  const createGroup = useCallback((memberKeys: string[], height: number) => store.createGroup(sectionId, store.getSection(sectionId).activeLayoutId ?? '', memberKeys, height), [sectionId]);
  const ungroup = useCallback((groupId: string) => store.ungroup(sectionId, store.getSection(sectionId).activeLayoutId ?? '', groupId), [sectionId]);
  const setDisplayVariant = useCallback((rowKey: string, variantId: string) => store.setDisplayVariant(sectionId, rowKey, variantId), [sectionId]);

  const activeLayout = section.layouts.find((l) => l.id === section.activeLayoutId) ?? null;
  const hiddenKeys = useMemo(() => new Set(store.getHiddenKeys(sectionId, section.activeLayoutId)), [sectionId, section]);
  const groups = useMemo(() => store.getGroups(sectionId, section.activeLayoutId), [sectionId, section]);
  const displayVariants = section.displayVariants ?? EMPTY_VARIANTS;

  return {
    layouts: section.layouts,
    activeLayoutId: section.activeLayoutId,
    activeLayout,
    hiddenKeys,
    groups,
    displayVariants,
    setActiveLayout,
    createLayout,
    updateLayoutItems,
    renameLayout,
    deleteLayout,
    toggleItemVisibility,
    createGroup,
    ungroup,
    setDisplayVariant,
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

/** Snapshot of the entire section-layout store, for export. */
export function exportSectionLayouts(): PersistedState {
  return store.exportState();
}

/** Replace the entire section-layout store with imported data. */
export function importSectionLayouts(state: PersistedState): void {
  store.replaceState(state ?? {});
}
