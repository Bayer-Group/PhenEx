import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { type SequentialRow } from '../studyRegistryUtils';
import { useSectionLayouts, buildDefaultLayoutItems } from '../SectionLayouts/sectionLayoutStore';
import { useSavedLayoutContext } from './SavedLayoutContext';
import styles from './LayoutControls.module.css';

// ── Props ────────────────────────────────────────────────────────────────

export interface LayoutControlsProps {
  /** Stable id of the section this control acts on. */
  sectionId: string;
  /** Rows of the current section (used to seed a new grid layout). */
  rows: SequentialRow[];
}

/**
 * Floating control at the top-right of a section card.
 *
 * The dropdown lists the section's *cohort-responsive* arrangements (list view
 * + grids) and, below, the *frozen* saved layouts (whole-report snapshots). The
 * Save button captures the current state as a new saved layout.
 */
export const LayoutControls = memo<LayoutControlsProps>(({ sectionId, rows }) => {
  const {
    layouts,
    activeLayoutId,
    activeLayout,
    setActiveLayout,
    createLayout,
    deleteLayout,
  } = useSectionLayouts(sectionId);
  const { savedLayouts, saveCurrent, applySaved, deleteSaved } = useSavedLayoutContext();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const triggerLabel = activeLayout ? activeLayout.name : 'List';

  const handleNewGrid = useCallback(() => {
    createLayout(`Grid ${layouts.length + 1}`, buildDefaultLayoutItems(rows.map((r) => r.name)));
    setOpen(false);
  }, [createLayout, layouts.length, rows]);

  const handleSave = useCallback(() => {
    const name = window.prompt('Name this saved layout', `Saved layout ${savedLayouts.length + 1}`)?.trim();
    if (name) saveCurrent(name);
  }, [saveCurrent, savedLayouts.length]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div ref={containerRef} className={styles.container} onClick={stop}>
      <button type="button" className={styles.trigger} onClick={() => setOpen((v) => !v)}>
        <span className={styles.triggerLabel}>{triggerLabel}</span>
        <span className={styles.caret}>▾</span>
      </button>
      <button type="button" className={styles.saveButton} onClick={handleSave} title="Save the current state as a named layout">
        Save layout
      </button>

      {open && (
        <div className={styles.menu}>
          <div className={styles.groupLabel}>Views</div>
          <button
            type="button"
            className={`${styles.item} ${activeLayoutId === null ? styles.itemActive : ''}`}
            onClick={() => { setActiveLayout(null); setOpen(false); }}
          >
            <span className={styles.check}>{activeLayoutId === null ? '✓' : ''}</span>
            <span className={styles.itemLabel}>List</span>
          </button>
          {layouts.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`${styles.item} ${activeLayoutId === l.id ? styles.itemActive : ''}`}
              onClick={() => { setActiveLayout(l.id); setOpen(false); }}
            >
              <span className={styles.check}>{activeLayoutId === l.id ? '✓' : ''}</span>
              <span className={styles.itemLabel}>{l.name}</span>
              <span
                className={styles.itemAction}
                role="button"
                title="Delete grid"
                onClick={(e) => { e.stopPropagation(); deleteLayout(l.id); }}
              >
                ×
              </span>
            </button>
          ))}
          <button type="button" className={`${styles.item} ${styles.addItem}`} onClick={handleNewGrid}>
            <span className={styles.check} />
            <span className={styles.itemLabel}>＋ New grid layout</span>
          </button>

          <div className={styles.divider} />
          <div className={styles.groupLabel}>Saved layouts</div>
          {savedLayouts.length === 0 && (
            <button type="button" className={styles.item} disabled>
              <span className={styles.check} />
              <span className={styles.itemLabel} style={{ color: '#aaa' }}>None yet</span>
            </button>
          )}
          {savedLayouts.map((s) => (
            <button
              key={s.id}
              type="button"
              className={styles.item}
              onClick={() => { applySaved(s.id); setOpen(false); }}
            >
              <span className={styles.check} />
              <span className={styles.itemLabel}>{s.name}</span>
              <span
                className={styles.itemAction}
                role="button"
                title="Delete saved layout"
                onClick={(e) => { e.stopPropagation(); deleteSaved(s.id); }}
              >
                ×
              </span>
            </button>
          ))}
          <button type="button" className={`${styles.item} ${styles.addItem}`} onClick={() => { handleSave(); setOpen(false); }}>
            <span className={styles.check} />
            <span className={styles.itemLabel}>＋ Save current layout…</span>
          </button>
        </div>
      )}
    </div>
  );
});
