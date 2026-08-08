import { memo, useEffect, useRef, useState } from 'react';
import styles from './LayoutControls.module.css';
import {
  useSectionLayouts,
  DEFAULT_COLUMN_OPTIONS,
  defaultLayoutId,
  defaultLayoutName,
  isDefaultLayoutId,
  defaultColumnsFromId,
} from './sectionLayoutStore';

interface LayoutControlsProps {
  /** Stable section id (same one passed to SectionCellContent). */
  sectionId: string;
  /** Row keys used to seed a new grid layout. */
  rowKeys: string[];
  /** Number of selected cohorts, used to size fresh grid tiles. */
  cohortCount: number;
  /** Responsive default column count derived from the card width. */
  defaultColumns?: number;
}

/**
 * Floating dropdown shown on a focused section cell. Lets the user switch
 * between the always-available default views (1–5 columns) and their saved
 * layouts. When a default is edited a draft is spawned in the background; this
 * control then surfaces a prominent "save layout?" panel to name and keep it.
 */
export const LayoutControls = memo(({ sectionId, defaultColumns = 3 }: LayoutControlsProps) => {
  const { layouts, activeLayout, activeLayoutId, setActiveLayout, saveDraft, renameLayout, deleteLayout } =
    useSectionLayouts(sectionId);
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const draft = activeLayout?.draft ? activeLayout : null;
  const savedLayouts = layouts.filter((l) => !l.draft);

  // Seed the name field whenever a new draft becomes active.
  useEffect(() => {
    if (draft) setDraftName(draft.name);
  }, [draft?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Column count of the active default (for the checkmark), else the responsive one.
  const activeDefaultCols = isDefaultLayoutId(activeLayoutId)
    ? defaultColumnsFromId(activeLayoutId!)
    : defaultColumns;
  const onDefault = draft == null && savedLayouts.every((l) => l.id !== activeLayoutId);

  const triggerLabel = draft?.name ?? activeLayout?.name ?? defaultLayoutName(activeDefaultCols);

  const handleSave = () => {
    if (draft) saveDraft(draft.id, draftName);
  };

  // Discard the draft and revert to the default (1–5 col) grid it derived from.
  const handleCancel = () => {
    if (draft) setActiveLayout(defaultLayoutId(draft.columnsPerRow ?? defaultColumns));
  };

  const handleRename = (layoutId: string, current: string) => {
    const name = window.prompt('Layout name', current)?.trim();
    if (name) renameLayout(layoutId, name);
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.topRow}>
        <button
          type="button"
          className={styles.trigger}
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        >
          <span className={styles.triggerLabel}>{triggerLabel}</span>
          <span className={styles.caret}>▾</span>
        </button>

        {open && (
          <div className={styles.menu} onClick={(e) => e.stopPropagation()}>
            <div className={styles.menuHeader}>Default views</div>
            {DEFAULT_COLUMN_OPTIONS.map((n) => {
              const active = onDefault && activeDefaultCols === n;
              return (
                <button
                  key={n}
                  type="button"
                  className={`${styles.item} ${active ? styles.itemActive : ''}`}
                  onClick={() => { setActiveLayout(defaultLayoutId(n)); setOpen(false); }}
                >
                  <span className={styles.check}>{active ? '●' : ''}</span>
                  <span className={styles.itemLabel}>{defaultLayoutName(n)}</span>
                </button>
              );
            })}

            {savedLayouts.length > 0 && <div className={styles.divider} />}
            {savedLayouts.map((l) => (
              <div key={l.id} className={`${styles.item} ${activeLayoutId === l.id ? styles.itemActive : ''}`}>
                <span className={styles.check}>{activeLayoutId === l.id ? '●' : ''}</span>
                <button
                  type="button"
                  className={styles.itemLabelBtn}
                  onClick={() => { setActiveLayout(l.id); setOpen(false); }}
                  onDoubleClick={() => handleRename(l.id, l.name)}
                  title="Click to switch, double-click to rename"
                >
                  {l.name}
                </button>
                <button
                  type="button"
                  className={styles.itemAction}
                  onClick={(e) => { e.stopPropagation(); handleRename(l.id, l.name); }}
                  title="Rename layout"
                >
                  ✎
                </button>
                <button
                  type="button"
                  className={styles.itemAction}
                  onClick={(e) => { e.stopPropagation(); deleteLayout(l.id); }}
                  title="Delete layout"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {draft && (
        <div className={styles.savePanel} onClick={(e) => e.stopPropagation()}>
          <span className={styles.savePrompt}>Save layout?</span>
          <input
            className={styles.saveInput}
            value={draftName}
            autoFocus
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
              else if (e.key === 'Escape') { e.preventDefault(); handleCancel(); }
            }}
            onPointerDown={(e) => e.stopPropagation()}
          />
          <button type="button" className={styles.saveBtn} onClick={handleSave}>
            Save
          </button>
          <button type="button" className={styles.cancelBtn} onClick={handleCancel}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
});

LayoutControls.displayName = 'LayoutControls';
