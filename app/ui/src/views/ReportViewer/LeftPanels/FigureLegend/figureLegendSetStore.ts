import { useCallback } from 'react';
import { useSyncExternalStore } from 'react';
import type { LegendItem, ColorOverrides } from '../../types';

/**
 * Persistent store for figure legend sets.
 *
 * A "figure legend set" captures the exact presentation state of the legend:
 * the ordered items (cohort order + spacers) and the per-cohort color
 * overrides. Sets are named, can be renamed, activated, and deleted — mirroring
 * the section layout store.
 *
 * Everything is scoped to a run (`runId`), persisted to localStorage, and shared
 * process-wide via a singleton store so every consumer observes the same state.
 *
 * The "working draft" (`scratch`) is a special, unnamed set that holds the live
 * arrangement that was active before the user switched to a named set. It lets
 * the user flip back and forth between saved sets and their in-progress work.
 */

// ── Types ────────────────────────────────────────────────────────────────

/** The exact presentation state captured by a figure legend set. */
export interface FigureLegendSetData {
  /** Ordered legend items: cohort selections interleaved with spacers. */
  items: LegendItem[];
  /** Manual per-cohort color overrides. */
  colorOverrides: ColorOverrides;
}

export interface FigureLegendSet {
  id: string;
  name: string;
  data: FigureLegendSetData;
}

/** Per-run persisted state. `activeSetId === null` ⇒ the working draft is live. */
interface RunState {
  sets: FigureLegendSet[];
  activeSetId: string | null;
  /** The "working draft": live state preserved when a named set is activated. */
  scratch: FigureLegendSetData | null;
}

type PersistedState = Record<string, RunState>;

// ── Persistence ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'phenex.figureLegendSets.v1';

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

class FigureLegendSetStore {
  private state: PersistedState = loadState();
  private listeners = new Set<Listener>();
  /** Cache of empty run states so getRun returns a stable reference. */
  private emptyCache = new Map<string, RunState>();

  private readonly EMPTY: RunState = { sets: [], activeSetId: null, scratch: null };

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getRun(runId: string): RunState {
    return this.state[runId] ?? this.emptyFor(runId);
  }

  private emptyFor(runId: string): RunState {
    let cached = this.emptyCache.get(runId);
    if (!cached) {
      cached = this.EMPTY;
      this.emptyCache.set(runId, cached);
    }
    return cached;
  }

  private update(runId: string, next: RunState) {
    this.state = { ...this.state, [runId]: next };
    saveState(this.state);
    this.notify();
  }

  createSet(runId: string, name: string, data: FigureLegendSetData): string {
    const run = this.getRun(runId);
    const id = `set_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const set: FigureLegendSet = { id, name, data };
    this.update(runId, { ...run, sets: [...run.sets, set], activeSetId: id });
    return id;
  }

  updateSetData(runId: string, setId: string, data: FigureLegendSetData) {
    const run = this.getRun(runId);
    const sets = run.sets.map((s) => (s.id === setId ? { ...s, data } : s));
    this.update(runId, { ...run, sets });
  }

  renameSet(runId: string, setId: string, name: string) {
    const run = this.getRun(runId);
    const sets = run.sets.map((s) => (s.id === setId ? { ...s, name } : s));
    this.update(runId, { ...run, sets });
  }

  deleteSet(runId: string, setId: string) {
    const run = this.getRun(runId);
    const sets = run.sets.filter((s) => s.id !== setId);
    const activeSetId = run.activeSetId === setId ? null : run.activeSetId;
    this.update(runId, { ...run, sets, activeSetId });
  }

  setActive(runId: string, setId: string | null) {
    const run = this.getRun(runId);
    if (run.activeSetId === setId) return;
    this.update(runId, { ...run, activeSetId: setId });
  }

  setScratch(runId: string, data: FigureLegendSetData) {
    const run = this.getRun(runId);
    this.update(runId, { ...run, scratch: data });
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

const store = new FigureLegendSetStore();

// ── React hook ───────────────────────────────────────────────────────────

export interface UseFigureLegendSets {
  sets: FigureLegendSet[];
  activeSetId: string | null;
  scratch: FigureLegendSetData | null;
  createSet: (name: string, data: FigureLegendSetData) => string;
  updateSetData: (setId: string, data: FigureLegendSetData) => void;
  renameSet: (setId: string, name: string) => void;
  deleteSet: (setId: string) => void;
  setActive: (setId: string | null) => void;
  setScratch: (data: FigureLegendSetData) => void;
}

export function useFigureLegendSets(runId: string): UseFigureLegendSets {
  const run = useSyncExternalStore(store.subscribe, () => store.getRun(runId));

  const createSet = useCallback((name: string, data: FigureLegendSetData) => store.createSet(runId, name, data), [runId]);
  const updateSetData = useCallback((setId: string, data: FigureLegendSetData) => store.updateSetData(runId, setId, data), [runId]);
  const renameSet = useCallback((setId: string, name: string) => store.renameSet(runId, setId, name), [runId]);
  const deleteSet = useCallback((setId: string) => store.deleteSet(runId, setId), [runId]);
  const setActive = useCallback((setId: string | null) => store.setActive(runId, setId), [runId]);
  const setScratch = useCallback((data: FigureLegendSetData) => store.setScratch(runId, data), [runId]);

  return {
    sets: run.sets,
    activeSetId: run.activeSetId,
    scratch: run.scratch,
    createSet,
    updateSetData,
    renameSet,
    deleteSet,
    setActive,
    setScratch,
  };
}

/** Snapshot of the entire figure-legend-set store, for export. */
export function exportFigureLegendSets(): PersistedState {
  return store.exportState();
}

/** Replace the entire figure-legend-set store with imported data. */
export function importFigureLegendSets(state: PersistedState): void {
  store.replaceState(state ?? {});
}
