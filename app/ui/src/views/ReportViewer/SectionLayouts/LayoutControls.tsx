import { memo, useEffect, useRef, useState } from 'react';
import styles from './LayoutControls.module.css';
import { useSectionLayouts, buildDefaultLayoutItems } from './sectionLayoutStore';

interface LayoutControlsProps {
  /** Stable section id (same one passed to SectionCellContent). */
  sectionId: string;
  /** Row keys used to seed a new grid layout. */
  rowKeys: string[];
  /** Number of selected cohorts, used to size fresh grid tiles. */
  cohortCount: number;
}

/**
 * Floating dropdown shown on a focused section cell. Mirrors the outline
 * panel's right-click menu: switch between the List view and named grid
 * layouts, create a new grid, or delete an existing one.
 */
export const LayoutControls = memo(({ sectionId, rowKeys, cohortCount }: LayoutControlsProps) => {
  const { layouts, activeLayout, activeLayoutId, setActiveLayout, createLayout, renameLayout, deleteLayout } =
    useSectionLayouts(sectionId);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const triggerLabel = activeLayout ? activeLayout.name : 'List';

  const handleNewGrid = () => {
    const name = `Grid ${layouts.length + 1}`;
    const id = createLayout(name, buildDefaultLayoutItems(rowKeys, cohortCount));
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
          <button
            type="button"
            className={`${styles.item} ${activeLayoutId === null ? styles.itemActive : ''}`}
            onClick={() => { setActiveLayout(null); setOpen(false); }}
          >
            <span className={styles.check}>{activeLayoutId === null ? '●' : ''}</span>
            <span className={styles.itemLabel}>List</span>
          </button>

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
