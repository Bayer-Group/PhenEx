import { memo, useEffect, useRef, useState } from 'react';
import styles from './LayoutControls.module.css';
import { useSectionLayouts, buildDefaultLayoutItems, useLayoutEditing } from './sectionLayoutStore';

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
 * Floating dropdown shown on a focused section cell. Mirrors the outline
 * panel's right-click menu: switch between the List view and named grid
 * layouts, create a new grid, or delete an existing one.
 */
export const LayoutControls = memo(({ sectionId, rowKeys, cohortCount, defaultColumns = 3 }: LayoutControlsProps) => {
  const { layouts, activeLayout, activeLayoutId, setActiveLayout, createLayout, renameLayout, deleteLayout, setColumnsPerRow } =
    useSectionLayouts(sectionId);
  const [open, setOpen] = useState(false);
  const [isEditing, setEditing] = useLayoutEditing(sectionId);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep latest values accessible without adding them as effect deps.
  const liveRef = useRef({ activeLayout, rowKeys, cohortCount, setColumnsPerRow });
  liveRef.current = { activeLayout, rowKeys, cohortCount, setColumnsPerRow };
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    if (isEditing) return;
    const { activeLayout: al, rowKeys: rk, cohortCount: cc, setColumnsPerRow: fn } = liveRef.current;
    if (!al) return;
    fn(al.id, defaultColumns, rk, cc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultColumns, isEditing]);

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

  const triggerLabel = activeLayout?.name ?? 'Default';

  const handleNewGrid = () => {
    const name = `Grid ${layouts.length + 1}`;
    const id = createLayout(name, buildDefaultLayoutItems(rowKeys, cohortCount, defaultColumns), defaultColumns);
    setActiveLayout(id);
    setOpen(false);
  };

  const handleRename = (layoutId: string, current: string) => {
    const name = window.prompt('Layout name', current)?.trim();
    if (name) renameLayout(layoutId, name);
  };

  const handleDelete = (layoutId: string) => {
    deleteLayout(layoutId);
  };

  return (
    <div className={styles.container} ref={containerRef}>
      {activeLayout && (
        <select
          className={styles.colSelect}
          value={activeLayout.columnsPerRow ?? 3}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation();
            setColumnsPerRow(activeLayout.id, Number(e.target.value), rowKeys, cohortCount);
          }}
          title="Columns per row"
        >
          {COLUMN_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      )}
      {activeLayout && activeLayout.id !== '__default__' && (
        <button
          type="button"
          className={`${styles.lockBtn} ${isEditing ? styles.lockBtnLocked : ''}`}
          onClick={(e) => { e.stopPropagation(); setEditing(!isEditing); }}
          title={isEditing ? 'Lock layout: exit drag/resize mode' : 'Unlock layout: enable drag and resize'}
        >
          {isEditing ? '🔓' : '🔒'}
        </button>
      )}
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
          <div className={`${styles.item} ${activeLayoutId === null ? styles.itemActive : ''}`}>
            <span className={styles.check}>{activeLayoutId === null ? '●' : ''}</span>
            <button
              type="button"
              className={styles.itemLabel}
              style={{ border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              onClick={() => { setActiveLayout(null); setOpen(false); }}
            >
              Default
            </button>
          </div>
          {layouts.length > 0 && <div className={styles.divider} />}
          {layouts.map((l) => (
            <div key={l.id} className={`${styles.item} ${activeLayoutId === l.id ? styles.itemActive : ''}`}>
              <span className={styles.check}>{activeLayoutId === l.id ? '●' : ''}</span>
              <button
                type="button"
                className={styles.itemLabel}
                style={{ border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
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
                onClick={(e) => { e.stopPropagation(); handleDelete(l.id); }}
                title="Delete layout"
              >
                ×
              </button>
            </div>
          ))}

          <div className={styles.divider} />

          <button
            type="button"
            className={`${styles.item} ${styles.addItem}`}
            onClick={handleNewGrid}
          >
            <span className={styles.check} />
            <span className={styles.itemLabel}>＋ New grid layout</span>
          </button>
        </div>
      )}
    </div>
  );
});

LayoutControls.displayName = 'LayoutControls';
