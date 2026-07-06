import { FC, useState, useCallback, useEffect, useRef } from 'react';
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

/**
 * The saved legend sets list, rendered at the bottom of the figure legend.
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

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

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
    <div className={styles.sets}>
      <div className={styles.setsHeader}>Legend sets</div>

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
  );
};
