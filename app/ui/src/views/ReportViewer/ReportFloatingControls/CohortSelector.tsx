import { FC, useState, useRef, useCallback } from 'react';
import { getCohortColor, type CohortGroup, type LegendSelection } from '../types';
import { useBarHoverStore } from '../GraphsAndTables/CellRenderers/useBarHoverStore';
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

  return (
    <div className={styles.legendBar}>
      {selections.map((sel, i) => (
        <LegendItem
          key={`${sel.cohortName}-${sel.colorIndex}`}
          selection={sel}
          dimmed={activeIndex !== null && activeIndex !== i}
          onClick={() => toggleCohort(i)}
          onRemove={() => onRemove(i)}
        />
      ))}
      <div style={{ height: 20 }} />
      <PlusButton onClick={handlePlusClick} />

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

  // Parse labels
  const idx = selection.cohortName.indexOf('__');
  const bottomLabel = idx === -1 ? 'main' : selection.cohortName.substring(idx + 2);
  const topLabel = idx === -1 ? selection.cohortName : selection.cohortName.substring(0, idx);

  return (
    <div
      className={styles.legendItem}
      style={{ opacity: dimmed ? 0.25 : 1, transition: 'opacity 0.15s ease', cursor: 'pointer' }}
      onClick={onClick}
    >
      <div className={styles.legendDot} style={{ background: color }} />
      <span className={styles.legendItemTop}>{topLabel}</span>
      <span className={styles.legendItemDot}>·</span>
      <span className={styles.legendItemBottom}>{bottomLabel}</span>
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
      aria-label="Add cohort"
      style={{ height: 30}}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
};
