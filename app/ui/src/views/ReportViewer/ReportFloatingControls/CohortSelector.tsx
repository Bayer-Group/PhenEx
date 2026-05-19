import { FC, useState, useCallback, useMemo } from 'react';
import { getCohortColor, type CohortGroup, type LegendSelection } from '../types';
import { useBarHoverStore } from '../GraphsAndTables/RowRenderers/useBarHoverStore';
import EyeSolidIcon from '../../../assets/icons/eye-solid.svg';
import EyeClosedIcon from '../../../assets/icons/eye-closed.svg';
import styles from './CohortSelector.module.css';

interface CohortSelectorProps {
  groups: CohortGroup[];
  selections: LegendSelection[];
  onReplace: (index: number, fullName: string) => void;
  onAdd: (fullName: string) => void;
  onRemove: (index: number) => void;
}

export const CohortSelector: FC<CohortSelectorProps> = ({
  groups,
  selections,
  onReplace,
  onAdd,
  onRemove,
}) => {
  const { activeIndex, onClick: toggleCohort } = useBarHoverStore();
  const [showAll, setShowAll] = useState(false);

  const activeSet = useMemo(() => new Set(selections.map((s) => s.cohortName)), [selections]);

  const activeColorMap = useMemo(
    () => new Map(selections.map((s) => [s.cohortName, getCohortColor(s.groupIndex, s.subIndex, s.totalSubs)])),
    [selections],
  );

  // Map fullName → selection index for quick lookup
  const selectionIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < selections.length; i++) {
      map.set(selections[i].cohortName, i);
    }
    return map;
  }, [selections]);

  const handleToggle = useCallback((fullName: string) => {
    if (activeSet.has(fullName)) {
      const idx = selectionIndexMap.get(fullName);
      if (idx != null) onRemove(idx);
    } else {
      onAdd(fullName);
    }
  }, [activeSet, selectionIndexMap, onAdd, onRemove]);

  // Group selections by parent for "hide" mode
  const groupedSelections = useMemo(() => {
    const map = new Map<string, { parent: string; items: { sel: LegendSelection; originalIndex: number }[] }>();
    const order: string[] = [];
    for (let i = 0; i < selections.length; i++) {
      const sel = selections[i];
      const parent = groups[sel.groupIndex]?.parent ?? sel.cohortName;
      if (!map.has(parent)) {
        map.set(parent, { parent, items: [] });
        order.push(parent);
      }
      map.get(parent)!.items.push({ sel, originalIndex: i });
    }
    return order.map((p) => map.get(p)!);
  }, [selections, groups]);

  return (
    <div className={styles.legendBar}>
      <div className={styles.actionBar}>
        <span className={styles.actionTitle}>Cohorts</span>
        <span className={styles.actionCount}>
          {selections.length}/{groups.reduce((n, g) => n + g.subcohorts.length, 0)}
        </span>
        <button
          className={styles.eyeToggle}
          onClick={() => setShowAll((v) => !v)}
          title={showAll ? 'Show selected only' : 'Show all cohorts'}
        >
          <img
            src={showAll ? EyeSolidIcon : EyeClosedIcon}
            alt={showAll ? 'Showing all' : 'Selected only'}
            className={styles.eyeIcon}
          />
        </button>
        <button
          className={styles.clearBtn}
          onClick={() => {
            for (const group of groups) {
              for (const sub of group.subcohorts) {
                if (!activeSet.has(sub.fullName)) onAdd(sub.fullName);
              }
            }
          }}
          disabled={groups.every((g) => g.subcohorts.every((s) => activeSet.has(s.fullName)))}
        >
          All
        </button>
        <button
          className={styles.clearBtn}
          onClick={() => { for (let i = selections.length - 1; i >= 0; i--) onRemove(i); }}
          disabled={selections.length === 0}
        >
          Clear
        </button>
      </div>

      {showAll ? (
        /* ── Show All mode: all cohorts from groups ─────────────────────── */
        groups.map((group) => (
          <div key={group.parent} className={styles.legendGroup}>
            <div className={styles.legendGroupTitle}>{group.parent}</div>
            {group.subcohorts.map((sub) => {
              const isActive = activeSet.has(sub.fullName);
              const color = activeColorMap.get(sub.fullName);
              const selIdx = selectionIndexMap.get(sub.fullName);
              return (
                <div
                  key={sub.fullName}
                  className={styles.legendItem}
                  style={{
                    opacity: isActive && activeIndex !== null && selIdx !== activeIndex ? 0.25 : 1,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    if (isActive && selIdx != null) toggleCohort(selIdx);
                    else handleToggle(sub.fullName);
                  }}
                >
                  <div
                    className={styles.legendDot}
                    style={{ background: isActive && color ? color : 'transparent', border: isActive ? '2px solid transparent' : '2px dashed #ccc' }}
                  />
                  <span className={`${styles.legendItemLabel} ${!isActive ? styles.legendItemLabelInactive : ''}`}>
                    {sub.label}
                  </span>
                  {isActive && (
                    <button
                      className={styles.removeBtn}
                      onClick={(e) => { e.stopPropagation(); handleToggle(sub.fullName); }}
                      aria-label="Remove cohort"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))
      ) : (
        /* ── Hide mode: only selected cohorts ──────────────────────────── */
        groupedSelections.map((group) => (
          <div key={group.parent} className={styles.legendGroup}>
            <div className={styles.legendGroupTitle}>{group.parent}</div>
            {group.items.map(({ sel, originalIndex }) => (
              <SelectedItem
                key={`${sel.cohortName}-${sel.colorIndex}`}
                selection={sel}
                dimmed={activeIndex !== null && activeIndex !== originalIndex}
                onClick={() => toggleCohort(originalIndex)}
                onRemove={() => onRemove(originalIndex)}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
};

/* ── SelectedItem (used in hide mode) ────────────────────────────────── */

interface SelectedItemProps {
  selection: LegendSelection;
  dimmed: boolean;
  onClick: () => void;
  onRemove: () => void;
}

const SelectedItem: FC<SelectedItemProps> = ({ selection, dimmed, onClick, onRemove }) => {
  const color = getCohortColor(selection.groupIndex, selection.subIndex, selection.totalSubs);
  const idx = selection.cohortName.indexOf('__');
  const label = idx === -1 ? 'main' : selection.cohortName.substring(idx + 2);

  return (
    <div
      className={styles.legendItem}
      style={{ opacity: dimmed ? 0.25 : 1, cursor: 'pointer' }}
      onClick={onClick}
    >
      <div className={styles.legendDot} style={{ background: color }} />
      <span className={styles.legendItemLabel}>{label}</span>
      <button
        className={styles.removeBtn}
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        aria-label="Remove cohort"
      >
        ×
      </button>
    </div>
  );
};
