import { useCallback, useSyncExternalStore } from 'react';
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
  /** Stable key of the item (row name). */
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SectionLayout {
  id: string;
  name: string;
  items: GridItem[];
}

/** Per-section persisted state. `activeLayoutId === null` ⇒ list view. */
interface SectionState {
  layouts: SectionLayout[];
  activeLayoutId: string | null;
}

type PersistedState = Record<string, SectionState>;

// ── Grid constants ───────────────────────────────────────────────────────

export const GRID_COLUMNS = 4;
export const GRID_ROW_HEIGHT = 130;
export const GRID_GAP = 14;

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

  deleteLayout(sectionId: string, layoutId: string) {
    const section = this.getSection(sectionId);
    const layouts = section.layouts.filter((l) => l.id !== layoutId);
    const activeLayoutId = section.activeLayoutId === layoutId ? null : section.activeLayoutId;
    this.update(sectionId, { layouts, activeLayoutId });
  }

  private notify() {
    for (const l of this.listeners) l();
  }
}

const store = new SectionLayoutStore();

// ── Default layout generation ────────────────────────────────────────────

/**
 * Build a default flow-packed grid layout for a set of item keys: each item is
 * a 2×2 tile, laid left-to-right and wrapping to the next band.
 */
export function buildDefaultLayoutItems(keys: string[]): GridItem[] {
  const w = 2;
  const h = 2;
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
  setActiveLayout: (layoutId: string | null) => void;
  createLayout: (name: string, items: GridItem[]) => string;
  updateLayoutItems: (layoutId: string, items: GridItem[]) => void;
  renameLayout: (layoutId: string, name: string) => void;
  deleteLayout: (layoutId: string) => void;
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

  const activeLayout = section.layouts.find((l) => l.id === section.activeLayoutId) ?? null;

  return {
    layouts: section.layouts,
    activeLayoutId: section.activeLayoutId,
    activeLayout,
    setActiveLayout,
    createLayout,
    updateLayoutItems,
    renameLayout,
    deleteLayout,
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
};

/** Subscribe to store changes (for components that render menus off it). */
export function subscribeSectionLayouts(listener: () => void): () => void {
  return store.subscribe(listener);
}
