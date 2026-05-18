import { FC, useState, useRef, useCallback, useMemo } from 'react';
import { getCohortColor, type CohortGroup, type LegendSelection } from '../types';
import { useBarHoverStore } from '../GraphsAndTables/RowRenderers/useBarHoverStore';
import { CohortMenu } from './CohortMenu';
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
  const [menuState, setMenuState] = useState<{
    rect: DOMRect;
  } | null>(null);

  const handlePlusClick = useCallback((el: HTMLElement) => {
    setMenuState({ rect: el.getBoundingClientRect() });
  }, []);

  const handleMenuSelect = useCallback(
    (fullName: string) => {
      onAdd(fullName);
    },
    [onAdd],
  );

  const handleMenuDeselect = useCallback(
    (fullName: string) => {
      const index = selections.findIndex((s) => s.cohortName === fullName);
      if (index >= 0) onRemove(index);
    },
    [selections, onRemove],
  );

  const handleClose = useCallback(() => setMenuState(null), []);

  // Group selections by parent cohort, preserving original indices
  const grouped = useMemo(() => {
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
          <PlusButton onClick={handlePlusClick} />
          <button
            className={styles.clearBtn}
            onClick={() => { for (let i = selections.length - 1; i >= 0; i--) onRemove(i); }}
            disabled={selections.length === 0}
          >
            Clear all
          </button>
        </div>

      {grouped.map((group) => (
        <div key={group.parent} className={styles.legendGroup}>
          <div className={styles.legendGroupTitle}>{group.parent}</div>
          {group.items.map(({ sel, originalIndex }) => (
            <LegendItem
              key={`${sel.cohortName}-${sel.colorIndex}`}
              selection={sel}
              dimmed={activeIndex !== null && activeIndex !== originalIndex}
              onClick={() => toggleCohort(originalIndex)}
              onRemove={() => onRemove(originalIndex)}
            />
          ))}
        </div>
      ))}
      <div style={{ height: 20 }} />

      {menuState && (
        <CohortMenu
          anchorRect={menuState.rect}
          groups={groups}
          activeSelections={selections}
          onSelect={handleMenuSelect}
          onDeselect={handleMenuDeselect}
          onClose={handleClose}
          closeOnSelect={false}
        />
      )}
    </div>
  );
};

/* ── LegendItem ──────────────────────────────────────────────────────── */

interface LegendItemProps {
  selection: LegendSelection;
  dimmed: boolean;
  onClick: () => void;
  onRemove: () => void;
}

const LegendItem: FC<LegendItemProps> = ({ selection, dimmed, onClick, onRemove }) => {
  const color = getCohortColor(selection.groupIndex, selection.subIndex, selection.totalSubs);

  // Parse labels — only show the subcohort part
  const idx = selection.cohortName.indexOf('__');
  const label = idx === -1 ? 'main' : selection.cohortName.substring(idx + 2);

  return (
    <div
      className={styles.legendItem}
      style={{ opacity: dimmed ? 0.25 : 1, transition: 'opacity 0.15s ease', cursor: 'pointer' }}
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

/* ── Plus Button ─────────────────────────────────────────────────────── */

interface PlusButtonProps {
  onClick: (el: HTMLElement) => void;
}

const PlusButton: FC<PlusButtonProps> = ({ onClick }) => {
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <button
      ref={ref}
      className={styles.plusBtn}
      onClick={() => ref.current && onClick(ref.current)}
      aria-label="Add a cohort"
      style={{ height: 30}}
    >
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
        <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span>Add a cohort</span>
    </button>
  );
};
