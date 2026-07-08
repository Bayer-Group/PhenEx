import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Multi-cell selection for the section grid.
 *
 * Selection is a plain set of item keys, kept in its own module so the grid
 * component stays focused on layout/interaction. The hook also owns the global
 * keyboard shortcuts that belong to selection:
 *
 *   • Escape        — clear the whole selection.
 *   • Cmd/Ctrl + A  — select every item (ignored while typing in a field).
 *
 * Per-cell behaviour (click to toggle, click a selected cell to deselect) is
 * driven by the grid calling `toggle`.
 */

export interface GridSelection {
  /** Keys currently selected. */
  selected: ReadonlySet<string>;
  isSelected: (key: string) => boolean;
  /** Add the key if absent, remove it if present. */
  toggle: (key: string) => void;
  /** Ensure the key is selected (used e.g. before a multi-drag). */
  add: (key: string) => void;
  /** Deselect everything. */
  clear: () => void;
  /** Select every current item. */
  selectAll: () => void;
  size: number;
}

/** True when focus sits in a control that owns Cmd/Ctrl+A itself. */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function useGridSelection(allKeys: string[], enabled = true): GridSelection {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  // Drop keys that no longer exist so a stale selection can't linger.
  const keysSignature = allKeys.join('\u0000');
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(allKeys);
      let changed = false;
      const next = new Set<string>();
      prev.forEach((k) => (valid.has(k) ? next.add(k) : (changed = true)));
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysSignature]);

  const toggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const add = useCallback((key: string) => {
    setSelected((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }, []);

  const clear = useCallback(() => {
    setSelected((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(allKeys));
  }, [keysSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clear();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        selectAll();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, clear, selectAll]);

  return useMemo<GridSelection>(
    () => ({
      selected,
      isSelected: (key: string) => selected.has(key),
      toggle,
      add,
      clear,
      selectAll,
      size: selected.size,
    }),
    [selected, toggle, add, clear, selectAll],
  );
}
