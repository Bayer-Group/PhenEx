import { useCallback, useSyncExternalStore } from 'react';
import type { LegendSelection, ColorOverrides } from '../types';

/**
 * Global store of "saved layouts".
 *
 * A {@link SavedLayout} is a frozen snapshot of the entire report presentation
 * state: which layout each section is arranged with, plus the visible cohorts
 * and their colors (and, in future, comments). Unlike per-section layouts —
 * which are cohort-responsive (the same arrangement re-renders with whatever
 * cohorts are selected) — a saved layout is a named, self-contained capture
 * that does not change when the cohort selection or colors change.
 *
 * Saved layouts are persisted to localStorage, scoped by report key.
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface SavedLayoutSnapshot {
  /** sectionId → active layout id (null = list view) for every section. */
  sectionActiveLayouts: Record<string, string | null>;
  /** Cohorts visible at save time. */
  selections: LegendSelection[];
  /** Per-cohort color overrides at save time. */
  colorOverrides: ColorOverrides;
}

export interface SavedLayout {
  id: string;
  name: string;
  createdAt: number;
  snapshot: SavedLayoutSnapshot;
}

type PersistedState = Record<string, SavedLayout[]>;

// ── Persistence ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'phenex.savedLayouts.v1';

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
    /* storage unavailable — ignore */
  }
}

// ── Store ────────────────────────────────────────────────────────────────

type Listener = () => void;
const EMPTY: SavedLayout[] = [];

class SavedLayoutStore {
  private state: PersistedState = loadState();
  private listeners = new Set<Listener>();

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  get(reportKey: string): SavedLayout[] {
    return this.state[reportKey] ?? EMPTY;
  }

  private update(reportKey: string, layouts: SavedLayout[]) {
    this.state = { ...this.state, [reportKey]: layouts };
    saveState(this.state);
    this.notify();
  }

  create(reportKey: string, name: string, snapshot: SavedLayoutSnapshot): string {
    const id = `saved_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const layout: SavedLayout = { id, name, createdAt: Date.now(), snapshot };
    this.update(reportKey, [...this.get(reportKey), layout]);
    return id;
  }

  rename(reportKey: string, id: string, name: string) {
    this.update(reportKey, this.get(reportKey).map((l) => (l.id === id ? { ...l, name } : l)));
  }

  remove(reportKey: string, id: string) {
    this.update(reportKey, this.get(reportKey).filter((l) => l.id !== id));
  }

  private notify() {
    for (const l of this.listeners) l();
  }
}

const store = new SavedLayoutStore();

// ── React hook ───────────────────────────────────────────────────────────

export interface UseSavedLayouts {
  savedLayouts: SavedLayout[];
  create: (name: string, snapshot: SavedLayoutSnapshot) => string;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
}

export function useSavedLayouts(reportKey: string): UseSavedLayouts {
  const savedLayouts = useSyncExternalStore(store.subscribe, () => store.get(reportKey));

  const create = useCallback((name: string, snapshot: SavedLayoutSnapshot) => store.create(reportKey, name, snapshot), [reportKey]);
  const rename = useCallback((id: string, name: string) => store.rename(reportKey, id, name), [reportKey]);
  const remove = useCallback((id: string) => store.remove(reportKey, id), [reportKey]);

  return { savedLayouts, create, rename, remove };
}
