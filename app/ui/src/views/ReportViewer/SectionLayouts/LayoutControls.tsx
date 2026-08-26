import { memo, useEffect, useRef, useState } from 'react';
import styles from './LayoutControls.module.css';
import { useSectionLayouts } from './sectionLayoutStore';

const COLUMN_OPTIONS = [1, 2, 3, 4, 5] as const;

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
 * Floating control shown on a focused section cell.
 *
 * - Column buttons (1–5): reposition the current layout to N columns without
 *   changing which items are visible. From "All" mode this creates a draft.
 * - Layout dropdown: switch between "All" (auto-arranged) and saved layouts.
 * - Save panel: shown when a draft is active so the user can name and keep it.
 */
export const LayoutControls = memo(({ sectionId, rowKeys, cohortCount }: LayoutControlsProps) => {
  const {
    layouts, activeLayout, activeLayoutId,
    setActiveLayout, saveDraft, renameLayout, deleteLayout,
    applyColumnRestack, hiddenKeys, globalColumnCount,
  } = useSectionLayouts(sectionId);
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const draft = activeLayout?.draft ? activeLayout : null;
  const savedLayouts = layouts.filter((l) => !l.draft);
  // In "All" mode show the global count; in a custom layout show its column count.
  const activeCols = activeLayoutId === null ? globalColumnCount : (activeLayout?.columnsPerRow ?? null);

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

  const triggerLabel = draft?.name ?? activeLayout?.name ?? 'All';

  const handleSave = () => {
    if (draft) saveDraft(draft.id, draftName);
  };

  const handleCancel = () => {
    if (draft) setActiveLayout(null);
  };

  const handleRename = (layoutId: string, current: string) => {
    const name = window.prompt('Layout name', current)?.trim();
    if (name) renameLayout(layoutId, name);
  };

  const handleColumnClick = (n: number) => {
    const visibleKeys = rowKeys.filter((k) => !hiddenKeys.has(k));
    applyColumnRestack(n, visibleKeys, cohortCount);
  };

  const isOnAll = activeLayoutId === null && !draft;

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.topRow}>
        {/* Column-count buttons: positioning tool, not layout selector */}
        <div className={styles.columnBtns} onClick={(e) => e.stopPropagation()}>
          {COLUMN_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={`${styles.colBtn} ${activeCols === n ? styles.colBtnActive : ''}`}
              title={`Arrange in ${n} column${n === 1 ? '' : 's'}`}
              onClick={() => handleColumnClick(n)}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Layout selector */}
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
            {/* "All" = no custom layout, auto-arranged */}
            <button
              type="button"
              className={`${styles.item} ${isOnAll ? styles.itemActive : ''}`}
              onClick={() => { setActiveLayout(null); setOpen(false); }}
            >
              <span className={styles.check}>{isOnAll ? '●' : ''}</span>
              <span className={styles.itemLabel}>All</span>
            </button>

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

