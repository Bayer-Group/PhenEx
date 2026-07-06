import { FC, useState, useCallback, useEffect, useRef } from 'react';
import { SimpleCustomScrollbar } from '../../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import type { FigureLegendSet } from './figureLegendSetStore';
import styles from './FigureLegend.module.css';

interface FigureLegendSetsProps {
  sets: FigureLegendSet[];
  activeSetId: string | null;
  onActivateSet: (setId: string) => void;
  onActivateScratch: () => void;
  onSaveNewSet: () => void;
  onRenameSet: (setId: string, name: string) => void;
  onDeleteSet: (setId: string) => void;
}

// Persisted panel geometry (UI-only; global, not per-run).
const HEIGHT_KEY = 'phenex.figureLegendSets.height';
const COLLAPSED_KEY = 'phenex.figureLegendSets.collapsed';
const MIN_HEIGHT = 84;
const MAX_HEIGHT = 460;
const DEFAULT_HEIGHT = 170;

function loadHeight(): number {
  const n = Number(localStorage.getItem(HEIGHT_KEY));
  return Number.isFinite(n) && n > 0 ? Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, n)) : DEFAULT_HEIGHT;
}

/**
 * The saved legend sets list, docked at the bottom of the figure legend.
 *
 * The panel is collapsible (caret in the header) and vertically resizable by
 * dragging its top border; both the height and collapsed state are persisted.
 *
 * The "Working draft" row represents the live, unsaved arrangement; selecting a
 * named set stashes the draft so the user can flip back to it. Named sets can be
 * activated (click), renamed (double-click), and deleted.
 */
export const FigureLegendSets: FC<FigureLegendSetsProps> = ({
  sets,
  activeSetId,
  onActivateSet,
  onActivateScratch,
  onSaveNewSet,
  onRenameSet,
  onDeleteSet,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '1');
  const [height, setHeight] = useState(loadHeight);
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  // Drag the top border to resize. Writes to the DOM live to avoid re-renders,
  // then commits (and persists) the final height on release.
  const handleResizeDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { startY: e.clientY, startHeight: rect.height };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current || !rootRef.current) return;
      const delta = ev.clientY - dragRef.current.startY;
      // Panel grows upward, so dragging up (negative delta) increases height.
      const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragRef.current.startHeight - delta));
      rootRef.current.style.height = `${next}px`;
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      dragRef.current = null;
      if (rootRef.current) {
        const h = rootRef.current.offsetHeight;
        setHeight(h);
        localStorage.setItem(HEIGHT_KEY, String(h));
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const startRename = useCallback((set: FigureLegendSet) => {
    setEditingId(set.id);
    setDraftName(set.name);
  }, []);

  const commitRename = useCallback(() => {
    if (editingId) {
      const name = draftName.trim();
      if (name) onRenameSet(editingId, name);
    }
    setEditingId(null);
  }, [editingId, draftName, onRenameSet]);

  return (
    <div
      ref={rootRef}
      className={`${styles.sets} ${collapsed ? styles.setsCollapsed : ''}`}
      style={collapsed ? undefined : { height }}
    >
      {!collapsed && <div className={styles.setsResizeHandle} onMouseDown={handleResizeDown} />}

      <button type="button" className={styles.setsHeader} onClick={toggleCollapsed}>
        <svg
          className={`${styles.setsCaret} ${collapsed ? '' : styles.setsCaretOpen}`}
          width="8"
          height="8"
          viewBox="0 0 8 8"
          fill="currentColor"
          aria-hidden
        >
          <path d="M2 0 L6 4 L2 8 Z" />
        </svg>
        <span>Legend sets</span>
      </button>

      {!collapsed && (
        <div className={styles.setsScrollRegion}>
          <div ref={bodyRef} className={styles.setsBody}>
            <button
              type="button"
              className={`${styles.setRow} ${activeSetId === null ? styles.setRowActive : ''}`}
              onClick={onActivateScratch}
              title="Live, unsaved arrangement"
            >
              <span className={styles.setName}>
                <em>Working draft</em>
              </span>
            </button>

            {sets.map((set) => {
              const isActive = set.id === activeSetId;
              return (
                <div
                  key={set.id}
                  className={`${styles.setRow} ${isActive ? styles.setRowActive : ''}`}
                  onClick={() => editingId !== set.id && onActivateSet(set.id)}
                  onDoubleClick={() => startRename(set)}
                  role="button"
                  tabIndex={0}
                >
                  {editingId === set.id ? (
                    <input
                      ref={inputRef}
                      className={styles.setNameInput}
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename();
                        else if (e.key === 'Escape') setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className={styles.setName}>{set.name}</span>
                  )}
                  <button
                    type="button"
                    className={styles.setDelete}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSet(set.id);
                    }}
                    title="Delete set"
                    aria-label="Delete set"
                  >
                    ×
                  </button>
                </div>
              );
            })}

            <button type="button" className={styles.saveSetButton} onClick={onSaveNewSet}>
              + Save current as new set
            </button>
          </div>
          <div className={styles.setsScrollbarRegion}>
            <SimpleCustomScrollbar
              targetRef={bodyRef}
              orientation="vertical"
              marginTop={4}
              marginBottom={4}
              marginToEnd={2}
              classNameTrack={styles.scrollBarTrack}
              classNameThumb={styles.scrollBarThumb}
              showOnHover={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};

