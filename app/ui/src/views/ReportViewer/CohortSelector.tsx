import { FC, useState, useRef, useCallback } from 'react';
import { getCohortColor, type CohortGroup, type LegendSelection } from './types';
import { useBarHoverStore } from './CellRenderers/useBarHoverStore';
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
  const { hoveredIndex } = useBarHoverStore();
  const [menuState, setMenuState] = useState<{
    type: 'replace' | 'add';
    index: number;
    rect: DOMRect;
  } | null>(null);

  const handleItemClick = useCallback(
    (index: number, el: HTMLElement) => {
      setMenuState({ type: 'replace', index, rect: el.getBoundingClientRect() });
    },
    [],
  );

  const handlePlusClick = useCallback((el: HTMLElement) => {
    setMenuState({ type: 'add', index: -1, rect: el.getBoundingClientRect() });
  }, []);

  const handleMenuSelect = useCallback(
    (fullName: string) => {
      if (!menuState) return;
      if (menuState.type === 'replace') {
        onReplace(menuState.index, fullName);
      } else {
        onAdd(fullName);
      }
    },
    [menuState, onReplace, onAdd],
  );

  const handleClose = useCallback(() => setMenuState(null), []);

  return (
    <div className={styles.legendBar}>
      {selections.map((sel, i) => (
        <LegendItem
          key={`${sel.cohortName}-${sel.colorIndex}`}
          selection={sel}
          dimmed={hoveredIndex !== null && hoveredIndex !== i}
          onClick={(el) => handleItemClick(i, el)}
          onRemove={() => onRemove(i)}
        />
      ))}
      <PlusButton onClick={handlePlusClick} />

      {menuState && (
        <CohortMenu
          anchorRect={menuState.rect}
          groups={groups}
          activeSelections={selections}
          onSelect={handleMenuSelect}
          onClose={handleClose}
          closeOnSelect={menuState.type === 'replace'}
        />
      )}
    </div>
  );
};

/* ── LegendItem ──────────────────────────────────────────────────────── */

interface LegendItemProps {
  selection: LegendSelection;
  dimmed: boolean;
  onClick: (el: HTMLElement) => void;
  onRemove: () => void;
}

const LegendItem: FC<LegendItemProps> = ({ selection, dimmed, onClick, onRemove }) => {
  const ref = useRef<HTMLDivElement>(null);
  const color = getCohortColor(selection.groupIndex, selection.subIndex, selection.totalSubs);

  // Parse labels
  const idx = selection.cohortName.indexOf('__');
  const bottomLabel = idx === -1 ? 'main' : selection.cohortName.substring(idx + 2);
  const topLabel = idx === -1 ? selection.cohortName : selection.cohortName.substring(0, idx);

  return (
    <div
      ref={ref}
      className={styles.legendItem}
      style={{ opacity: dimmed ? 0.25 : 1, transition: 'opacity 0.15s ease' }}
      onClick={() => ref.current && onClick(ref.current)}
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
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
};
