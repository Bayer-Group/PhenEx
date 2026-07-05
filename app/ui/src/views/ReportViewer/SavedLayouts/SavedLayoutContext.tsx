import { createContext, useCallback, useContext, useMemo, useRef, type FC, type ReactNode } from 'react';
import type { LegendSelection, ColorOverrides } from '../types';
import { sectionLayoutActions } from '../SectionLayouts/sectionLayoutStore';
import { useSavedLayouts, type SavedLayout } from './savedLayoutStore';

// ── Context value ──────────────────────────────────────────────────────────

export interface SavedLayoutContextValue {
  savedLayouts: SavedLayout[];
  /** Capture the current whole-report state as a new saved layout. */
  saveCurrent: (name: string) => void;
  /** Re-apply a saved layout. Currently restores section arrangement only. */
  applySaved: (id: string) => void;
  renameSaved: (id: string, name: string) => void;
  deleteSaved: (id: string) => void;
}

const SavedLayoutContext = createContext<SavedLayoutContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

interface ProviderProps {
  reportKey: string;
  /** Live report state, read at save time via refs to avoid stale captures. */
  selections: LegendSelection[];
  colorOverrides: ColorOverrides;
  children: ReactNode;
}

export const SavedLayoutProvider: FC<ProviderProps> = ({ reportKey, selections, colorOverrides, children }) => {
  const { savedLayouts, create, rename, remove } = useSavedLayouts(reportKey);

  // Keep the latest live state accessible to saveCurrent without re-creating it.
  const stateRef = useRef({ selections, colorOverrides });
  stateRef.current = { selections, colorOverrides };

  const saveCurrent = useCallback((name: string) => {
    const { selections: sel, colorOverrides: colors } = stateRef.current;
    create(name, {
      sectionActiveLayouts: sectionLayoutActions.getActiveLayoutMap(),
      selections: sel,
      colorOverrides: colors,
    });
  }, [create]);

  const applySaved = useCallback((id: string) => {
    const layout = savedLayouts.find((l) => l.id === id);
    if (!layout) return;
    // Answer (per product): applying restores arrangement only for now; the
    // snapshotted cohorts/colors are retained for future (comment-linked) use.
    sectionLayoutActions.applyActiveLayoutMap(layout.snapshot.sectionActiveLayouts);
  }, [savedLayouts]);

  const value = useMemo<SavedLayoutContextValue>(() => ({
    savedLayouts,
    saveCurrent,
    applySaved,
    renameSaved: rename,
    deleteSaved: remove,
  }), [savedLayouts, saveCurrent, applySaved, rename, remove]);

  return <SavedLayoutContext.Provider value={value}>{children}</SavedLayoutContext.Provider>;
};

// ── Hook ───────────────────────────────────────────────────────────────────

export function useSavedLayoutContext(): SavedLayoutContextValue {
  const ctx = useContext(SavedLayoutContext);
  if (!ctx) throw new Error('useSavedLayoutContext must be used within a SavedLayoutProvider');
  return ctx;
}

